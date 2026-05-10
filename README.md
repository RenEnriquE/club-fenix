# Club Atlético Independencia Fénix

## Configuración rápida

### Variables de entorno (Vercel)
```
VITE_SUPABASE_URL=https://octfpmtbijskluyyppuh.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_lUu4q1p8LO4mtAbYHt47KA_BDV1ENgg
```

---

## PASO 1 — Base de datos Supabase

### 1.1 Crear tablas
1. Ve a [supabase.com](https://supabase.com) → tu proyecto
2. Menú izquierdo: **SQL Editor → New query**
3. Pega el contenido de `supabase_schema.sql` → **Run**

### 1.2 Cargar datos históricos
1. SQL Editor → **New query**
2. Pega el contenido de `seed.sql` → **Run**
   *(326 personas + 3.431 pagos 2024–2026)*

### 1.3 Crear usuarios
**Authentication → Users → Add user → Create new user**

Crea al menos dos:

| Email | Contraseña sugerida | Rol |
|-------|---------------------|-----|
| admin@clubfenix.cl | Admin2024!Fenix | admin |
| comite@clubfenix.cl | Comite2024!Fenix | comite |

### 1.4 Asignar roles
Copia el UUID de cada usuario (columna "UID" en Authentication → Users), luego en SQL Editor:

```sql
INSERT INTO user_roles (user_id, role, email) VALUES
  ('PEGA-UUID-ADMIN-AQUI',  'admin',  'admin@clubfenix.cl'),
  ('PEGA-UUID-COMITE-AQUI', 'comite', 'comite@clubfenix.cl');
```

---

## PASO 2 — GitHub

```bash
# Descomprime el ZIP, entra a la carpeta
cd club-fenix

# Inicializa git
git init
git add .
git commit -m "feat: sistema Club Fénix v1"

# Crea el repo en github.com, luego:
git remote add origin https://github.com/TU_USUARIO/club-fenix.git
git branch -M main
git push -u origin main
```

---

## PASO 3 — Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → importa `club-fenix`
2. **Environment Variables** → agrega:
   - `VITE_SUPABASE_URL` = `https://octfpmtbijskluyyppuh.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_lUu4q1p8LO4mtAbYHt47KA_BDV1ENgg`
3. **Deploy** → listo

Cada `git push` hace deploy automático.

---

## Desarrollo local

```bash
npm install
cp .env.example .env    # ya tiene las credenciales correctas
npm run dev
```

---

## Roles

| Rol | Acceso |
|-----|--------|
| `admin` | Dashboard + Pagos + Socios (editar) + Comité |
| `comite` | Dashboard + Socios (lectura) + Comité |
