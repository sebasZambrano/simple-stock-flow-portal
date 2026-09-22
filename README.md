# simple-stock-flow-portal

Cliente web del sistema de **Productos y Ventas**: Angular 20, componentes *standalone* y
*signals*, arquitectura hexagonal.

Se ocupa de pintar las pantallas, adelantar las validaciones obvias y hablar HTTP con la API.
**De nada más**: no tiene base de datos, no guarda datos de negocio, no sirve las imágenes y
ninguna de sus validaciones es la definitiva. Eso es del backend (`simple-stock-flow-api`).

> ### Léelo antes de probarlo
>
> Hoy **no se puede entrar a la aplicación**. El backend todavía no implementa el login:
> `POST /api/auth/login` responde **500**, la pantalla de acceso no deja pasar y las otras
> cinco páginas quedan detrás del guard, inalcanzables. El fallo no está en este repositorio.
> Ver [Qué falta](#qué-falta).

---

## Cómo se levanta

Requisitos: **Node** en el rango que pide Angular CLI 20 —`^20.19.0 || ^22.12.0 || >=24.0.0`—
y, solo para los tests, un **Chrome o Chromium** instalado. La imagen de Docker compila con
`node:22-alpine`; lo de aquí abajo se verificó con Node 24.11.1.

```bash
npm ci
npx ng serve
```

Queda en `http://localhost:4200`. Compila y sirve aunque no exista ningún backend: las
peticiones fallarán con «No hay conexión con el servidor», que es lo que dice el interceptor
de errores ante un `status 0`.

**A qué backend apunta.** `environment.apiUrl` vale `/api` en los dos entornos: el front nunca
conoce el host del backend, y por eso en desarrollo no hay CORS. Quien resuelve ese `/api` en
desarrollo es `proxy.conf.json`, que reenvía `/api` y `/media` a `http://localhost:5000`.

**Para que ese puerto tenga a alguien escuchando**, levanta la pila con el solapamiento de
desarrollo, que publica la API en `localhost:5000`:

```bash
cd ../simple-stock-flow-infra
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --wait
```

> El fichero base **no** publica el backend al host. Si levantas solo con él, `ng serve` reenvía a
> un puerto vacío y toda petición muere con «No hay conexión con el servidor». Con `dotnet run` el
> backend usa los puertos de su `launchSettings.json`: ajusta entonces el `target` de
> `proxy.conf.json`.

### Producción

```bash
docker build -t simple-stock-flow-portal .
```

> **Cambiar el código no basta: hay que reconstruir.** `docker compose up -d --wait` adopta la
> imagen que ya lleva la etiqueta y **no reconstruye nunca**. Una imagen construida antes del
> último cambio sigue sirviendo el bundle viejo sin que nada chille. Después de tocar `src/` o
> `nginx.conf`: `docker compose build portal` y vuelve a levantar. La §6 de `verify.sh` existe
> justo para que esto no se olvide otra vez.

Dos etapas: compila con `node:22-alpine` y sirve el bundle estático con `nginx:1.27-alpine`.
Ese nginx hace de proxy de `/api/` y `/media/` hacia **`http://service:8080`**.

> **`service` es el nombre del servicio en el `docker-compose.yml` de `simple-stock-flow-infra`, y
> está escrito a mano en `nginx.conf`. Si se renombra ese servicio en el compose, el portal
> deja de alcanzar la API** y hay que tocar `nginx.conf` en el mismo cambio.

Levantado por ese compose, el portal se publica en el puerto `PORTAL_PORT` (`8080` por
defecto) y las rutas de Angular se resuelven con el `try_files` del nginx.

#### Las tres reglas del `nginx.conf` que no son obvias

Cada una nació de un fallo medido, y quitarla lo devuelve:

| Regla | Por qué está |
|---|---|
| `location ^~ /media/` | En nginx **las expresiones regulares ganan a los prefijos**. Sin el `^~`, el bloque de assets estáticos —`…png\|jpg\|jpeg…`— se quedaba con `/media/foto.jpg` y respondía su propia página de 404 de 153 bytes: de los tres tipos que la API acepta subir, **solo `webp` se veía**. Es el defecto **A-6**, e incumplía CA-03.1 |
| `client_max_body_size 30m` | Sin declararlo rige **1 MB**, así que una foto de móvil corriente recibía un **413 en HTML** y el `422` con «La imagen supera el máximo de 5 MB.» que decide el contrato (E-08) era **inalcanzable** por el puerto 8080. El límite de negocio lo aplica el servicio; nginx no debe ponerle uno más bajo por detrás. `30m` es el único techo físico que queda, el de Kestrel |
| `resolver 127.0.0.11` más `proxy_pass` con variable | Con un nombre literal, nginx resuelve `service` **una sola vez al arrancar**. Cada vez que el backend se reconstruye, el contenedor cambia de dirección y el portal devolvía **502** hasta que alguien lo reiniciaba. Con la variable vuelve a resolver, y el DNS de Docker vive en `127.0.0.11` |

`verify.sh`, en `simple-stock-flow-infra`, comprueba las tres desde fuera, y además que el `nginx.conf`
que corre el contenedor sea este.

### El nombre interno no es el del repositorio

El repositorio se llama `simple-stock-flow-portal`; el proyecto Angular se llama
**`simple-stock-flow-app`** (`angular.json` y el campo `name` de `package.json`). Por eso el build
sale en `dist/simple-stock-flow-app/browser/`, que es la ruta exacta que copia el `Dockerfile`. Es
intencional, y confunde si nadie lo avisa: si renombras uno, renombra los tres.

---

## Dónde están los datos

**Este repositorio no almacena ningún dato de negocio.** Ni base de datos, ni IndexedDB, ni
caché en disco. Productos, ventas, categorías y reportes viven en el backend y se piden por
HTTP cada vez que hacen falta.

Lo único que persiste en el navegador es **la sesión**:

| | |
|---|---|
| Dónde | `localStorage` del navegador |
| Clave | **`simple-stock-flow.session`** |
| Qué guarda | el token de acceso, su fecha de caducidad, el usuario y su rol |
| Quién la toca | `src/app/infrastructure/http/local-session.storage.ts`, y nadie más |

- Para verla: consola del navegador → `localStorage.getItem('simple-stock-flow.session')`.
- Para cerrar sesión a mano: borra esa clave y recarga.
- Lecturas y escrituras van dentro de `try/catch`. En modo privado, con el almacenamiento
  bloqueado o con el JSON corrupto, la sesión vive solo en memoria de la pestaña: el login
  **no se rompe**, simplemente no sobrevive a una recarga.
- El token viaja en `Authorization: Bearer` (`auth.interceptor.ts`). Un 401 borra la sesión y
  devuelve a `/login` (`error.interceptor.ts`).

**Las imágenes de producto tampoco están aquí.** El formulario las sube a
`POST /api/products/{id}/image`; el backend las guarda —en el compose, un volumen de Docker— y
las publica bajo **`/media`**, que el proxy de desarrollo y el nginx de producción reenvían al
servicio. El portal solo recibe la URL ya resuelta dentro del DTO del producto; no guarda
copias.

---

## Cómo se prueba

```bash
npx ng test --watch=false --browsers=ChromeHeadless
```

Resultado: **`TOTAL: 42 SUCCESS`** (2026-09-19).

Necesita un Chrome o Chromium instalado, porque Karma lo lanza con `karma-chrome-launcher`.
**No necesita** backend, ni Docker, ni base de datos.

Los specs del dominio (`money.spec.ts`, `cart.policy.spec.ts`) corren sin `TestBed`: son
funciones puras sobre TypeScript sin Angular. Que puedan correr así es el indicador de que la
capa está bien aislada.

Compilar:

```bash
npx ng build
```

Bundle limpio —sin errores ni avisos de presupuesto— en `dist/simple-stock-flow-app/browser/`.

---

## Cómo está organizado

Hexagonal, aplicado al cliente.

```
src/app/
├─ domain/          TypeScript puro: modelos, Money, Quantity, políticas. Cero Angular.
├─ application/     Puertos (clases abstractas), casos de uso y stores con signals.
├─ infrastructure/  Adaptadores: repositorios HttpClient, mappers DTO ↔ dominio, interceptores.
└─ presentation/    Las seis páginas standalone, el layout, los guards y la UI compartida.
```

Tres reglas sostienen la estructura:

1. **`domain/` no importa nada de Angular**, y sus specs corren sin `TestBed`.
2. **Los puertos son `abstract class`, no `interface`** — a propósito: una interface desaparece
   al compilar y no sirve como token de inyección. Por eso funciona
   `{ provide: ProductRepositoryPort, useClass: HttpProductRepository }`.
3. **`infrastructure/providers.ts` es el único punto de composición.** Cambiar el backend real
   por mocks es cambiar ese arreglo y nada más.

Los componentes llaman a **casos de uso** o a **stores**; jamás a un puerto ni a un repositorio.

**Duplicación deliberada:** `domain/policies/cart.policy.ts` y `domain/policies/stock.policy.ts`
repiten reglas que el backend también aplica —no hay venta sin líneas, no se vende más stock del
que hay—. Existen para responder al instante sin ida y vuelta al servidor. **La verdad sigue
siendo del servidor:** si ambos discrepan, manda el backend.

### Las seis páginas

| Ruta | Página | Quién entra |
|---|---|---|
| `/login` | `login.page.ts` | cualquiera |
| `/productos` | `product-list.page.ts` | autenticado |
| `/productos/nuevo` · `/productos/:id` | `product-form.page.ts` | rol `admin` |
| `/ventas/nueva` | `new-sale.page.ts` | autenticado |
| `/ventas` | `sale-list.page.ts` | autenticado |
| `/reportes` | `sales-report.page.ts` | autenticado |

Las seis se cargan de forma diferida: cada una es su propio chunk en el build. Todo lo que no
es `/login` cuelga del `Shell` y pasa por `authGuard`.

---

## Qué falta

**Lo que impide usar el sistema no está en este repositorio.** El portal está completo como
cliente. Falta al otro lado, y comprobado contra el sistema levantado:

1. **No se puede iniciar sesión.** `AuthenticationService` de `simple-stock-flow-api` está sin
   implementar y `POST /api/auth/login` devuelve **500**. Consecuencia directa: nadie pasa de
   la pantalla de acceso, y las otras cinco páginas no se pueden ejercer.
2. **`GET /api/categories` no existe: responde 404.** El portal ya lo invoca
   (`ListCategoriesUseCase` → `ProductRepositoryPort.listCategories`), pero en el backend no hay
   controlador para esa ruta. Sin ese endpoint, el formulario de producto no puede pintar el
   selector de categoría. Es la única brecha del contrato: el resto de rutas que llama el portal
   sí están declaradas al otro lado.
3. **Catálogo, consulta de ventas y reporte tampoco están implementados en el backend.** Aunque
   mañana funcione el login, esas pantallas seguirán vacías hasta que se cierren. `GET
   /api/products` sí responde **401** sin token: la seguridad está puesta, los datos no.

Pendiente de este lado, sin bloquear a nadie:

- La cobertura de tests llega al dominio y al arranque de la app —10 specs—; no hay tests de
  los componentes ni de los adaptadores HTTP.
- Las páginas son funcionales y deliberadamente austeras: tablas, formularios y mensajes de
  error, sin biblioteca de componentes.
- `Product.imageUrl` viaja desde la API hasta el modelo, pero ninguna pantalla muestra todavía
  la imagen; por ahora solo se puede subir desde el formulario de producto.

---

La especificación, los ADR y el plan de tareas viven en el repositorio `simple-stock-flow-docs`,
fuera de este. Nada de lo de arriba depende de tenerlo.


## Cómo se clona

El sistema vive en repositorios separados y **el compose construye desde las carpetas hermanas**,
así que la disposición no es cosmética: hay que clonarlos en el mismo directorio y con su nombre.

```bash
mkdir simple-stock-flow && cd simple-stock-flow
git clone https://github.com/code-dev-projects/simple-stock-flow-infra.git
git clone https://github.com/code-dev-projects/simple-stock-flow-api.git
git clone https://github.com/code-dev-projects/simple-stock-flow-portal.git
```

```
simple-stock-flow/
├── simple-stock-flow-infra/     compose, .env.example y verify.sh
├── simple-stock-flow-api/       backend .NET 8
└── simple-stock-flow-portal/    front Angular 20
```

`simple-stock-flow-docs` no hace falta para levantar el sistema: guarda el material de trabajo.

## Licencia

MIT. Copyright (c) 2026 Jesus Ariel Gonzalez Bonilla. El texto completo está en
[`LICENSE`](LICENSE): puede usarse, copiarse, modificarse y distribuirse libremente, con la única
condición de conservar el aviso de copyright.
