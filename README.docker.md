# REGO Premium — landing

Sitio estático (HTML/CSS/JS sin build step). `three.js` y `GSAP` se cargan
desde CDN, así que el contenedor **necesita salida a internet** para que se
vean los shaders y las animaciones de scroll.

## Levantar con Docker

```bash
docker compose up -d --build
```

→ http://localhost:8081

Parar:

```bash
docker compose down
```

## Sin compose

```bash
docker build -t rego-hotel-landing .
docker run -d --name rego-hotel-landing -p 8081:80 rego-hotel-landing
```

## Desarrollo sin Docker

El repo trae su propio servidor (evita el problema de index.html cacheado —
ver el docstring de `devserver.py`):

```bash
python devserver.py 5270
```

→ http://localhost:5270

No abras `index.html` con `file://`: los `.mp4` y los shaders fallan por CORS.

## Detalles

- `nginx.conf` — gzip, cache largo para imágenes/video, `no-cache` para HTML
  (la versión producción del fix de `devserver.py`), y `/healthz` para el
  healthcheck del contenedor.
- `/reserva` resuelve a `reserva.html` (placeholder; `booking.css` y
  `booking.js` están en el repo, todavía sin enlazar).
- Rutas desconocidas dan 404 (no es una SPA).
