# Social Hate Analyzer - Documentación Técnica Completa

## 📋 Descripción del Proyecto

**Social Hate Analyzer** es una aplicación full-stack para detectar y analizar toxicidad, hate speech y sentimientos negativos en comentarios de YouTube usando IA (Google Gemini). El proyecto proporciona análisis detallados de videos, canales y tendencias de toxicidad.

**Repositorio Original:** https://github.com/miguelreymon/socialhate.firebase

---

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico

**Frontend:**
- React 19
- TailwindCSS + shadcn/ui (componentes)
- Recharts (gráficos)
- Framer Motion (animaciones)
- esbuild-loader (compilación optimizada para archivos grandes)
- Axios (HTTP client)

**Backend:**
- FastAPI (Python 3.11+)
- Firebase Admin SDK + Firestore (base de datos NoSQL)
- Google Gemini 2.0 Flash (análisis de IA)
- YouTube Data API v3 (obtención de comentarios)
- APScheduler (tareas programadas)

**Base de Datos:**
- Firestore (Firebase) - NoSQL cloud database
- Colecciones: `analyses`, `channels`, `reports`, `tracked_channels`, `scheduled_analyses`, `youtube_cache`, `channel_cards`

---

## 🔧 Cómo Funciona el Sistema

### 1. Flujo de Análisis de un Video

```
[Usuario] → [Frontend] → [Backend API] → [YouTube API] → [Comentarios]
                                ↓
                         [Gemini AI Analysis]
                                ↓
                         [Firestore Storage]
                                ↓
                         [Frontend Display]
```

**Paso a paso:**

1. **Usuario ingresa URL de YouTube**
   - Ejemplo: `https://www.youtube.com/watch?v=VIDEO_ID`
   - Frontend envía POST a `/api/youtube/analyze`

2. **Backend extrae video ID**
   - Regex para extraer ID del video de diferentes formatos de URL
   - Valida que sea una URL válida de YouTube

3. **Descarga información del video (YouTube API)**
   - Título, canal, thumbnail, vistas, likes, comentarios
   - **Consumo:** 1 request de YouTube API

4. **Descarga comentarios (YouTube API)**
   - Obtiene **200 comentarios** por video
   - Mezcla de comentarios por:
     - **TIME** (recientes - suelen tener más hate)
     - **RELEVANCE** (populares)
   - **Consumo:** 2-4 requests de YouTube API (paginación)

5. **Análisis con Gemini AI (4 bloques de 50 comentarios)**
   - Divide 200 comentarios en **4 bloques de 50**
   - Cada bloque hace 1 llamada a Gemini
   - **Delay de 4 segundos entre bloques** (respeta 15 RPM)
   - **Consumo:** 4 requests de Gemini API
   - **Tiempo total:** ~16-20 segundos por video

6. **Análisis de IA por comentario**
   - Sentiment score (-1 a 1)
   - Hate score (0 a 1)
   - Sentiment label (positive/negative/neutral)
   - Is hate (true/false)
   - Emotion (joy/anger/sadness/fear/surprise/disgust)
   - Comment type (praise/criticism/question/suggestion/spam)

7. **Guardado en Firestore**
   - Análisis completo del video
   - Todos los comentarios analizados
   - Estadísticas agregadas

8. **Mostrar en Frontend**
   - Dashboard con resultados
   - Gráficos de sentimiento
   - Lista de comentarios con scores
   - Badges de toxicidad

---

## 🎯 APIs Utilizadas

### 1. YouTube Data API v3

**Propósito:** Obtener información de videos y comentarios

**Endpoints usados:**
- `youtube.videos().list()` - Info del video
- `youtube.commentThreads().list()` - Comentarios
- `youtube.channels().list()` - Info de canales
- `youtube.search().list()` - Búsqueda de canales

**Límites:**
- **10,000 unidades por día**
- Sin límite por minuto/hora

**Consumo por video:**
- Fetch video details: 1 unidad
- Fetch comments: 1 unidad por cada 100 comentarios
- **Total por video:** ~3-5 unidades

**Cuota diaria disponible:** ~2,000-3,000 videos por día

**Configuración:**
```python
YOUTUBE_API_KEY=AIzaSyDSHD8e75PzmZ6JzmqtRdMbL94PryZy7KY
```

---

### 2. Google Gemini API

**Propósito:** Análisis de sentimiento y detección de hate speech

**Modelo usado:** `gemini-2.0-flash` (más rápido, económico)

**Límites (Plan Gratuito):**
- **15 RPM** (requests por minuto)
- **1,500 RPD** (requests por día)
- 1 millón tokens por minuto

**Consumo por video:**
- 200 comentarios ÷ 50 = **4 bloques**
- **4 requests de Gemini** por video

**Cuota diaria disponible con 1 API:** ~375 videos/día (1,500 ÷ 4)
**Cuota diaria disponible con 2 APIs:** ~750 videos/día

**Configuración (Sistema Dual):**
```python
GEMINI_API_KEY=AIzaSyD8za5fliHWb6di0bSnjOrUM2S1z2UyGAU  # Principal
GEMINI_API_KEY_BACKUP=AIzaSyAMezfNpDYGN1-qbII8_woFHR3WvNxXn7s  # Respaldo
```

**Sistema de Failover:**
1. Intenta con API Principal (5 reintentos)
2. Si falla → Cambia automáticamente a API Respaldo (5 reintentos más)
3. Total: 10 reintentos con backoff exponencial
4. Si falla todo → Error 503 claro (nunca datos falsos)

---

### 3. Firebase/Firestore

**Propósito:** Base de datos NoSQL en tiempo real

**Credenciales:**
```json
{
  "type": "service_account",
  "project_id": "basketstats-analyzer",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@basketstats-analyzer.iam.gserviceaccount.com",
  ...
}
```

**Colecciones:**
- `analyses` - Análisis de videos
- `channels` - Información de canales verificados
- `reports` - Reportes de comentarios incorrectos
- `tracked_channels` - Canales en seguimiento automático
- `scheduled_analyses` - Análisis programados
- `youtube_cache` - Cache de respuestas de YouTube API
- `channel_cards` - Tarjetas de canales verificados

**Límites (Plan Gratuito):**
- 50K lecturas/día
- 20K escrituras/día
- 20K deletes/día

---

## ⚡ Sistema de Optimización de Cuota Gemini

### Problema:
- Límite de 15 RPM (requests por minuto)
- Con análisis de 200 comentarios → 4 requests por video
- Sin rate limiting → Error 429 (cuota excedida)

### Solución Implementada:

#### 1. **Procesamiento en Bloques**
```python
# Divide 200 comentarios en 4 bloques de 50
batch_size = 50
for batch_start in range(0, 200, batch_size):
    batch_comments = comments[batch_start:batch_end]
    # Analiza este bloque
    analyze_with_gemini(batch_comments)
    # Espera 4 segundos antes del siguiente bloque
    await asyncio.sleep(4)
```

**Beneficio:**
- 4 bloques × 4 segundos = 16 segundos por video
- 60 segundos ÷ 16 segundos = ~3.75 videos por minuto
- 3.75 × 4 requests = **15 RPM** (perfecto para el límite)

#### 2. **Rate Limiting Inteligente entre Videos**

```python
# Análisis múltiples videos
if total_videos > 10:
    delay_between_videos = 20  # 20s = 3 videos/min
elif total_videos > 5:
    delay_between_videos = 10  # 10s = 6 videos/min
else:
    delay_between_videos = 5   # 5s para pocos videos
```

**Ejemplo con 50 videos:**
- Delay: 20 segundos entre videos
- Tiempo interno: 16 segundos (4 bloques)
- Total por video: 36 segundos
- 50 videos × 36s = 1,800s = **30 minutos**
- Rate: 200 requests ÷ 30 min = **6.6 requests/min** ✅ (muy por debajo de 15 RPM)

#### 3. **Sistema de Reintentos con Backoff Exponencial**

```python
max_retries = 10
for attempt in range(max_retries):
    try:
        # Intenta análisis con Gemini
        response = await gemini_api_call()
        break
    except Exception as e:
        # Backoff exponencial: 2s, 4s, 8s, 16s, 30s
        wait_time = min(2 ** attempt, 30)
        await asyncio.sleep(wait_time)
        
        # Switch a API de respaldo después de 5 intentos
        if attempt == 5 and backup_api_available:
            switch_to_backup_api()
```

**Beneficio:**
- Si hay error 429 (rate limit) → espera y reintenta
- No pierde el trabajo ya hecho
- Cambia a API de respaldo automáticamente

#### 4. **Cache de YouTube API**

```python
# Cache de respuestas de YouTube para reducir cuota
youtube_cache = {
    "channel_videos": 6 hours,  # Videos de un canal
    "video_info": 24 hours,     # Info de video
    "channel_info": 24 hours    # Info de canal
}
```

**Beneficio:**
- Reduce llamadas repetidas a YouTube API
- Ahorra cuota diaria
- Análisis más rápidos en requests subsiguientes

#### 5. **Sistema Dual de APIs Gemini**

```python
# API Principal
GEMINI_API_KEY = "key_1"

# API Respaldo (se activa automáticamente)
GEMINI_API_KEY_BACKUP = "key_2"

# Capacidad total
# 1 API: 1,500 RPD
# 2 APIs: 3,000 RPD
# = ~750 videos por día con 2 APIs
```

---

## 📦 Configuración Rápida del Proyecto

### 1. Clonar Repositorio

```bash
git clone https://github.com/miguelreymon/socialhate.firebase.git
cd socialhate.firebase
```

### 2. Configurar Backend

```bash
cd backend

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
nano .env
```

**Editar `.env`:**
```bash
YOUTUBE_API_KEY=tu_youtube_api_key
GEMINI_API_KEY=tu_gemini_api_key_principal
GEMINI_API_KEY_BACKUP=tu_gemini_api_key_respaldo
ADMIN_USERNAME=admin
ADMIN_PASSWORD=tu_password_seguro
```

**Configurar Firebase:**
1. Ir a [Firebase Console](https://console.firebase.google.com/)
2. Project Settings → Service Accounts
3. Generate new private key
4. Guardar como `backend/firebase-credentials.json`

**Iniciar backend:**
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Configurar Frontend

```bash
cd frontend

# Instalar dependencias
yarn install

# Configurar variables de entorno
cp .env.example .env
nano .env
```

**Editar `.env`:**
```bash
REACT_APP_BACKEND_URL=http://localhost:8001
```

**Iniciar frontend:**
```bash
yarn start
```

La app estará en: `http://localhost:3000`

---

## 🔑 Obtener API Keys

### YouTube API Key
1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear nuevo proyecto o seleccionar existente
3. APIs & Services → Library
4. Buscar "YouTube Data API v3" → Enable
5. Credentials → Create Credentials → API Key
6. Copiar la key

### Gemini API Key
1. Ir a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Get API Key → Create API key
3. Copiar la key
4. **Recomendado:** Crear 2 keys para sistema dual

### Firebase Credentials
1. Ir a [Firebase Console](https://console.firebase.google.com/)
2. Agregar proyecto o seleccionar existente
3. Project Settings (⚙️) → Service Accounts
4. Generate new private key
5. Descargar JSON y guardar como `firebase-credentials.json`

---

## 📊 Capacidades y Límites del Sistema

### Con 1 API de Gemini:
- **15 RPM** (requests por minuto)
- **1,500 RPD** (requests por día)
- **~300-375 videos por día**

### Con 2 APIs de Gemini (Recomendado):
- **30 RPM** combinados
- **3,000 RPD** combinados
- **~600-750 videos por día**

### YouTube API:
- **10,000 unidades por día**
- **~2,000-3,000 videos por día**

### Cuellos de Botella:
- **Gemini API** es el limitante (no YouTube)
- Con 2 APIs Gemini → puedes analizar ~600 videos/día
- YouTube API permite mucho más

---

## 🎯 Funcionalidades Principales

### 1. Análisis de Videos
- Entrada: URL de YouTube
- Output: Análisis completo con:
  - Porcentaje de hate speech
  - Sentimientos (positivo, negativo, neutral)
  - Gráficos de evolución
  - Lista de comentarios con scores
  - Badges de toxicidad

### 2. Dashboard de Canales
- Análisis agregado por canal
- Estadísticas: videos analizados, comentarios, hate promedio
- Ranking de canales por toxicidad
- Tarjetas verificadas compartibles

### 3. Panel de Administración
- Análisis en lote (hasta 50 videos)
- Seguimiento automático de canales
- Gestión de análisis programados
- Rate limiting inteligente

### 4. Sistema de Reportes
- Usuarios pueden reportar análisis incorrectos
- Feedback para mejorar el sistema
- Corrección manual de análisis

---

## 🚨 Problemas Comunes y Soluciones

### Error 429: Rate Limit Exceeded (Gemini)
**Causa:** Demasiadas requests a Gemini en poco tiempo
**Solución:**
- Esperar 1 minuto
- Usar API de respaldo (se activa automáticamente)
- Reducir número de videos simultáneos

### Error 503: Service Unavailable
**Causa:** Gemini API falló después de 10 reintentos
**Solución:**
- Verificar que API keys sean válidas
- Revisar cuota en [Google AI Studio](https://aistudio.google.com/app/apikey)
- Esperar unos minutos y reintentar

### Frontend no compila
**Causa:** Archivos grandes (AnalysisDetail.jsx, AdminPanel.jsx)
**Solución:**
- Ya configurado con esbuild-loader
- Si falla: `rm -rf node_modules/.cache && yarn start`

### Backend no inicia
**Causa:** Firebase credentials incorrectas
**Solución:**
- Verificar `firebase-credentials.json` existe y es válido
- Verificar todas las API keys en `.env`

---

## 📈 Arquitectura de Rate Limiting

```
┌─────────────────────────────────────────────────────────────┐
│                    ANÁLISIS DE 50 VIDEOS                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────────┐
                    │ Delay inteligente:   │
                    │ 20s entre videos     │
                    └─────────────────────┘
                              ↓
         ┌────────────────────┴────────────────────┐
         │                                          │
    Video 1                                    Video 2
         │                                          │
    ┌────┴────┐                              ┌────┴────┐
    │ Bloque 1│ (50 comentarios)             │ Bloque 1│
    │ 4s wait │                              │ 4s wait │
    ├─────────┤                              ├─────────┤
    │ Bloque 2│                              │ Bloque 2│
    │ 4s wait │                              │ 4s wait │
    ├─────────┤                              ├─────────┤
    │ Bloque 3│                              │ Bloque 3│
    │ 4s wait │                              │ 4s wait │
    ├─────────┤                              ├─────────┤
    │ Bloque 4│                              │ Bloque 4│
    └─────────┘                              └─────────┘
    Total: ~16s                              Total: ~16s
         │                                          │
         └──────────── 20s delay ────────────────┘
                              ↓
                         Video 3...

Total para 50 videos: ~30 minutos
Rate: 6.6 requests/min (muy seguro)
```

---

## 🔒 Seguridad y Mejores Prácticas

### ✅ HACER:
- Usar variables de entorno para API keys
- Nunca subir `.env` o `firebase-credentials.json` a GitHub
- Usar `.gitignore` para proteger archivos sensibles
- Cambiar contraseñas de admin por defecto
- Usar HTTPS en producción

### ❌ NO HACER:
- Hardcodear API keys en el código
- Compartir `firebase-credentials.json` públicamente
- Usar contraseñas débiles para admin
- Exceder límites de cuota intencionalmente
- Modificar rate limiting sin entender consecuencias

---

## 📝 Estructura de Archivos Importante

```
socialhate.firebase/
├── backend/
│   ├── server.py              # API principal
│   ├── requirements.txt       # Dependencias Python
│   ├── .env                   # Variables de entorno (NO SUBIR)
│   ├── .env.example          # Plantilla de .env
│   └── firebase-credentials.json  # Credenciales Firebase (NO SUBIR)
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx       # Página principal
│   │   │   ├── Dashboard.jsx         # Dashboard de análisis
│   │   │   ├── AnalysisDetail.jsx    # Detalle de análisis (784 líneas)
│   │   │   ├── ChannelDetail.jsx     # Perfil de canal (784 líneas)
│   │   │   ├── ChannelsPage.jsx      # Lista de canales
│   │   │   └── AdminPanel.jsx        # Panel admin (995 líneas)
│   │   ├── context/
│   │   │   └── LanguageContext.jsx   # Contexto de idioma (ES por defecto)
│   │   └── components/
│   │       └── ui/                   # Componentes shadcn/ui
│   ├── package.json
│   ├── .env                   # Variables frontend (NO SUBIR)
│   ├── .env.example          # Plantilla
│   └── craco.config.js       # Config webpack (esbuild-loader)
│
└── README.md                  # Este archivo
```

---

## 🎓 Prompt para LLMs (Configuración Rápida)

```
Este es un proyecto de análisis de toxicidad en YouTube llamado "Social Hate Analyzer".

STACK:
- Backend: FastAPI + Firebase/Firestore + Gemini AI + YouTube API
- Frontend: React 19 + TailwindCSS + shadcn/ui

ANÁLISIS:
1. Descarga 200 comentarios de YouTube
2. Los divide en 4 bloques de 50
3. Cada bloque se analiza con Gemini AI (4 requests)
4. Delay de 4s entre bloques (respeta 15 RPM)
5. Guarda en Firestore
6. Muestra resultados en frontend

RATE LIMITING:
- Gemini: 15 RPM, 1,500 RPD
- Sistema dual de APIs (principal + respaldo)
- Failover automático tras 5 intentos
- ~600 videos/día con 2 APIs

CONFIGURACIÓN:
1. Backend .env:
   YOUTUBE_API_KEY=...
   GEMINI_API_KEY=...
   GEMINI_API_KEY_BACKUP=...
   
2. firebase-credentials.json (desde Firebase Console)

3. Frontend .env:
   REACT_APP_BACKEND_URL=http://localhost:8001

4. Instalar:
   backend: pip install -r requirements.txt
   frontend: yarn install

5. Ejecutar:
   backend: uvicorn server:app --host 0.0.0.0 --port 8001
   frontend: yarn start

ARCHIVOS GRANDES:
- AnalysisDetail.jsx (784 líneas)
- ChannelDetail.jsx (784 líneas)
- AdminPanel.jsx (995 líneas)
Usa esbuild-loader para compilar (ya configurado)

IDIOMA: Español por defecto (LanguageContext.jsx)
```

---

## 📞 Soporte y Recursos

- **Repositorio:** https://github.com/miguelreymon/socialhate.firebase
- **YouTube API Docs:** https://developers.google.com/youtube/v3
- **Gemini API Docs:** https://ai.google.dev/docs
- **Firebase Docs:** https://firebase.google.com/docs
- **React Docs:** https://react.dev

---

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles.

---

**Autor:** Miguel Reymon

**Última actualización:** Febrero 2026
