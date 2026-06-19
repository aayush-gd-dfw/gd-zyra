FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:20-alpine
RUN npm install -g serve
COPY --from=build /app/dist /app/dist
WORKDIR /app
CMD sh -c "serve -s dist -l tcp://0.0.0.0:${PORT:-3000}"
