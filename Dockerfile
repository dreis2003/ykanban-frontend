FROM node:24-alpine AS build
WORKDIR /build

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Variáveis VITE_* são embutidas no bundle em build time — nunca em runtime.
# Em docker-compose local, aponta para a porta do backend publicada no host,
# já que quem chama a API é o navegador do usuário, não este container.
ARG VITE_API_BASE_URL=http://localhost:8080/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY --from=build /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
