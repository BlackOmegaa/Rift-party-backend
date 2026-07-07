# Rift-party-backend

## Deploiement (Railway)

`railway.json` fixe explicitement la start command sur `npm run start:prod`
(= `prisma migrate deploy && node dist/main`). Sans ce fichier, Railway
(Nixpacks) lance `npm start` par defaut (`nest start`), qui NE PASSE PAS par
les migrations Prisma : la DB peut rester desynchronisee du schema apres un
redeploy.

Si un jour les migrations ne s'appliquent quand meme pas automatiquement,
fix manuel depuis un shell avec le `DATABASE_URL` de prod :

```bash
cd backend
DATABASE_URL="<url-prod>" npx prisma migrate deploy
```
