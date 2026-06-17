FROM mcr.microsoft.com/playwright:v1.48.0-jammy AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.48.0-jammy AS production

WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

EXPOSE 3001

RUN mkdir -p /app/storage && chown -R pwuser:pwuser /app

USER pwuser

CMD ["node", "dist/index.js"]
