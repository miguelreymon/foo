# 🔥 Social Hate Analyzer

**Aplicación completa para análisis de toxicidad y odio en comentarios de redes sociales usando Inteligencia Artificial.**

Analiza comentarios de **YouTube** e **Instagram** para detectar hate speech, toxicidad, y sentimiento usando Google Gemini 2.0 Flash.

![Social Hate Analyzer](https://img.shields.io/badge/version-2.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Python](https://img.shields.io/badge/python-3.11+-yellow) ![React](https://img.shields.io/badge/react-19-blue)

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Arquitectura](#-arquitectura)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Sistema de Rate Limiting](#-sistema-de-rate-limiting-gemini)
- [API Endpoints](#-api-endpoints)
- [Uso de la Aplicación](#-uso-de-la-aplicación)
- [Seguridad](#-seguridad)
- [Despliegue](#-despliegue-en-producción)
- [Solución de Problemas](#-solución-de-problemas)
- [Tecnologías](#-tecnologías)

---

## 🚀 Características

### Análisis de YouTube
- ✅ Análisis de **200 comentarios por video** en bloques de 50
- ✅ Detección de hate speech con **Gemini 2.0 Flash**
- ✅ Sistema de **failover automático** con API de respaldo
- ✅ Rate limiting inteligente (soporta hasta **50 videos simultáneos**)
- ✅ Análisis de canales completos con historial

### Análisis de Instagram (NUEVO)
- ✅ Análisis de comentarios en **posts, reels e IGTV**
- ✅ Exploración de perfiles con posts recientes
- ✅ Hasta **200 comentarios por publicación**
- ✅ Integración con **Instagram Looter API** (RapidAPI)

### Dashboard y Reportes
- ✅ Dashboard con rankings de canales por toxicidad
- ✅ Sistema de canales verificados con **tarjetas compartibles**
- ✅ Generación de **reportes PDF** profesionales
- ✅ Pronóstico del "clima de hate" basado en historial
- ✅ Panel de administración protegido

### Análisis de IA
- ✅ Detección de sentimiento (positivo/negativo/neutro)
- ✅ Score de toxicidad (0-100%)
- ✅ Clasificación de emociones (alegría, ira, tristeza, etc.)
- ✅ Identificación de spam y trolls
- ✅ Trending topics y palabras clave

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                    React 19 + TailwindCSS                    │
│                 (puerto 3000 - hot reload)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ HTTPS /api/*
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│                   FastAPI (puerto 8001)                      │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   YouTube   │  │  Instagram  │  │   Gemini AI        │  │
│  │   Data API  │  │ Looter API  │  │   (Análisis)       │  │
│  │     v3      │  │  (RapidAPI) │  │                    │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────┬──────────┘  │
│         │                │                    │             │
│         └────────────────┼────────────────────┘             │
│                          │                                   │
│                          ▼                                   │
│              ┌───────────────────────┐                      │
│              │    Firebase/Firestore │                      │
│              │      (Base de Datos)  │                      │
│              └───────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### Colecciones de Firebase

| Colección | Descripción |
|-----------|-------------|
| `analyses` | Resultados de análisis (YouTube + Instagram) |
| `channels` | Información de canales analizados |
| `reports` | Reportes de usuarios sobre análisis incorrectos |
| `tracked_channels` | Canales en seguimiento automático |
| `channel_cards` | Tarjetas de canales verificados |
| `youtube_cache` | Cache de datos de YouTube (ahorro de cuota) |

---

## 📋 Requisitos

### Software
- **Node.js** 16+ (recomendado 18+)
- **Python** 3.11+
- **yarn** (gestor de paquetes frontend)

### API Keys Necesarias

| API | Propósito | Obtener en |
|-----|-----------|------------|
| **YouTube Data API v3** | Obtener videos y comentarios | [Google Cloud Console](https://console.cloud.google.com/) |
| **Google Gemini API** | Análisis de IA (principal) | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| **Gemini API Backup** | Failover automático (opcional) | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| **RapidAPI Key** | Instagram Looter API | [RapidAPI](https://rapidapi.com/irrors-apis/api/instagram-looter2) |
| **Firebase Credentials** | Base de datos Firestore | [Firebase Console](https://console.firebase.google.com/) |

---

## 🛠️ Instalación

### 1. Clonar repositorio

```bash
git clone https://github.com/tu-usuario/socialhate.firebase.git
cd socialhate.firebase
```

### 2. Configurar Backend

```bash
cd backend

# Crear entorno virtual (recomendado)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus API keys (ver sección Configuración)

# Configurar Firebase
# 1. Ir a Firebase Console → Project Settings → Service Accounts
# 2. Generar nueva clave privada
# 3. Guardar como backend/firebase-credentials.json
```

### 3. Configurar Frontend

```bash
cd frontend

# Instalar dependencias
yarn install

# Configurar variables de entorno
cp .env.example .env
# Editar REACT_APP_BACKEND_URL si es necesario
```

### 4. Iniciar la Aplicación

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
yarn start
```

La aplicación estará disponible en `http://localhost:3000`

---

## ⚙️ Configuración

### Backend (.env)

```env
# MongoDB (ignorado si usas Firebase)
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"

# CORS
CORS_ORIGINS="*"

# YouTube API
YOUTUBE_API_KEY="AIzaSy..."

# Gemini AI - PRINCIPAL
GEMINI_API_KEY="AIzaSy..."

# Gemini AI - RESPALDO (recomendado)
GEMINI_API_KEY_BACKUP="AIzaSy..."

# Firebase (para deployment)
GOOGLE_APPLICATION_CREDENTIALS_JSON=""

# Admin Panel
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="tu_password_seguro"

# Instagram (RapidAPI)
RAPIDAPI_KEY="tu_rapidapi_key"
```

### Frontend (.env)

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## 🔄 Sistema de Rate Limiting (Gemini)

El sistema implementa un manejo inteligente de las limitaciones de la API de Gemini para evitar errores de cuota.

### ¿Cómo Funciona?

```
┌─────────────────────────────────────────────────────────────┐
│                 FLUJO DE ANÁLISIS                            │
│                                                              │
│  Video → Obtener 200 comentarios → Dividir en 4 lotes de 50 │
│                                                              │
│  Lote 1 ──► Gemini API ──► Esperar 4s                       │
│  Lote 2 ──► Gemini API ──► Esperar 4s                       │
│  Lote 3 ──► Gemini API ──► Esperar 4s                       │
│  Lote 4 ──► Gemini API ──► Completado                       │
│                                                              │
│  Tiempo total por video: ~16-20 segundos                    │
└─────────────────────────────────────────────────────────────┘
```

### Sistema de Failover

```
Intento 1-5  ──► API Principal (GEMINI_API_KEY)
                    │
                    │ Si falla 5 veces
                    ▼
Intento 6-10 ──► API Respaldo (GEMINI_API_KEY_BACKUP)
                    │
                    │ Si falla 10 veces
                    ▼
              ERROR 503 (no hay fallback a análisis neutral)
```

### Límites y Capacidad

| Configuración | RPM | RPD | Videos/Día | Tiempo/50 Videos |
|---------------|-----|-----|------------|------------------|
| **1 API Gemini** | 15 | 1,500 | ~300 | ~30 min |
| **2 APIs (failover)** | 30 | 3,000 | ~600 | ~30 min |

### Delays Automáticos

| Cantidad de Videos | Delay entre Videos |
|-------------------|-------------------|
| 1-5 videos | 5 segundos |
| 6-10 videos | 10 segundos |
| 11-50 videos | 20 segundos |

---

## 🔌 API Endpoints

### YouTube

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/youtube/analyze` | Analizar un video |
| `GET` | `/api/youtube/analyze/{id}` | Obtener análisis |
| `GET` | `/api/analyses` | Listar todos los análisis |

**Ejemplo - Analizar Video:**
```bash
curl -X POST "http://localhost:8001/api/youtube/analyze" \
  -H "Content-Type: application/json" \
  -d '{"youtube_url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

### Instagram

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/instagram/analyze` | Analizar post o perfil |
| `GET` | `/api/instagram/user/{username}` | Info de usuario |
| `GET` | `/api/instagram/post/{shortcode}` | Info de publicación |

**Ejemplo - Analizar Post de Instagram:**
```bash
curl -X POST "http://localhost:8001/api/instagram/analyze" \
  -H "Content-Type: application/json" \
  -d '{"instagram_url": "https://www.instagram.com/p/ABC123/"}'
```

**Ejemplo - Explorar Perfil:**
```bash
curl -X POST "http://localhost:8001/api/instagram/analyze" \
  -H "Content-Type: application/json" \
  -d '{"instagram_url": "https://www.instagram.com/username/"}'
```

### Canales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/channels` | Listar canales |
| `GET` | `/api/channels/{id}` | Detalle de canal |
| `GET` | `/api/channels/{id}/analyses` | Análisis del canal |

### Admin (Requiere autenticación)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/admin/analyze-videos` | Analizar múltiples videos |
| `GET` | `/api/admin/dashboard` | Dashboard admin |
| `POST` | `/api/admin/channel-cards` | Crear tarjeta de canal |

---

## 📱 Uso de la Aplicación

### 1. Página Principal
- Pega una URL de YouTube o Instagram
- Haz clic en "Analizar"
- Espera el procesamiento (~16 segundos por video)

### 2. Dashboard
- Ve el ranking de canales por toxicidad
- Explora análisis recientes
- Filtra por plataforma (YouTube/Instagram)

### 3. Detalle de Canal
- Historial de análisis
- "Clima del hate" (pronóstico basado en tendencia)
- Estadísticas agregadas
- Tarjeta compartible

### 4. Panel Admin
- URL: `/admin`
- Usuario/Password configurados en `.env`
- Analizar múltiples videos a la vez
- Gestionar canales verificados
- Ver reportes de usuarios

---

## 🔒 Seguridad

### Archivos Protegidos

El `.gitignore` protege automáticamente:

```
# Nunca subir estos archivos a Git
.env
.env.*
!.env.example
firebase-credentials.json
```

### Checklist de Seguridad

- [ ] Cambiar `ADMIN_PASSWORD` del valor por defecto
- [ ] No compartir API keys en código
- [ ] Usar HTTPS en producción
- [ ] Configurar CORS restrictivo en producción
- [ ] Rotar API keys periódicamente

---

## 🚀 Despliegue en Producción

### Backend (Docker)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

### Variables de Entorno en Producción

```bash
# En lugar de archivos .env, usa variables del sistema
export GEMINI_API_KEY="..."
export YOUTUBE_API_KEY="..."
export GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
```

### Frontend (Build)

```bash
cd frontend
yarn build
# Sirve la carpeta build/ con nginx
```

---

## 🐛 Solución de Problemas

### Error 503: Gemini API Failed

**Causas:**
- API key inválida
- Cuota agotada (15 RPM / 1,500 RPD)
- Ambas APIs (principal y backup) fallaron

**Soluciones:**
1. Verificar API keys en [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Esperar unos minutos si alcanzaste el límite
3. Agregar una segunda API key de respaldo
4. Revisar logs: `tail -f /var/log/supervisor/backend.err.log`

### Instagram API: Failed to fetch comments

**Causas:**
- RAPIDAPI_KEY no configurada
- Post privado o restringido
- Cuenta suspendida

**Soluciones:**
1. Verificar RAPIDAPI_KEY en `.env`
2. Probar con un post público diferente
3. Verificar suscripción en RapidAPI

### Frontend no carga / Pantalla blanca

**Soluciones:**
```bash
# Limpiar cache
rm -rf node_modules/.cache
yarn start

# Verificar variable de entorno
echo $REACT_APP_BACKEND_URL
```

### Análisis muy lentos

Es comportamiento **normal y esperado**:
- 1 video: ~16-20 segundos
- 10 videos: ~5-8 minutos
- 50 videos: ~25-35 minutos

Esto es por diseño para respetar los límites de la API de Gemini.

---

## 📦 Tecnologías

### Frontend
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| React | 19 | Framework UI |
| TailwindCSS | 3.x | Estilos |
| shadcn/ui | latest | Componentes |
| Recharts | 2.x | Gráficos |
| Framer Motion | 11.x | Animaciones |
| esbuild-loader | 4.x | Build optimizado |

### Backend
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| FastAPI | 0.115+ | Framework API |
| Firebase Admin | 6.x | Firestore DB |
| google-genai | latest | Gemini AI |
| google-api-python-client | 2.x | YouTube API |
| httpx | 0.28+ | HTTP async (Instagram) |
| ReportLab | 4.x | Generación PDF |

---

## 📄 Licencia

MIT License - ver archivo [LICENSE](LICENSE) para más detalles.

## 👤 Autor

**Miguel Reymon**

---

⭐ Si este proyecto te resulta útil, considera darle una estrella en GitHub
"# foodiesfake" 
"# foodiesfake" 
