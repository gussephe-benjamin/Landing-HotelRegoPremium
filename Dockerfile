# REGO Premium — landing estática servida por nginx.
# El sitio no tiene build step: three.js y GSAP llegan por CDN y el resto
# son archivos planos, así que basta con copiarlos al docroot.
FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="rego-hotel-landing" \
      org.opencontainers.image.description="Landing page de REGO Premium Apart Hotel"

COPY nginx.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY --chown=nginx:nginx . .

# nginx.conf ya está en /etc/nginx y devserver.py es solo para desarrollo;
# fuera del docroot.
RUN rm -f nginx.conf devserver.py

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
   CMD wget -qO- http://127.0.0.1/healthz || exit 1
