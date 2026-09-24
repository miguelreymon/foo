-- =======================================================
-- SQL Editor Script para FoodiesFake en Supabase
-- Ejecuta este script en el SQL Editor de tu panel de Supabase:
-- https://supabase.com/dashboard/project/lomcvvkxidctepztqisy/sql
-- =======================================================

-- 1. Tabla de Reality Checks (Coherencia gastronómica e influencers)
CREATE TABLE IF NOT EXISTS public.reality_checks (
    id TEXT PRIMARY KEY,
    video_id TEXT,
    video_url TEXT,
    video_title TEXT,
    channel_name TEXT,
    thumbnail_url TEXT,
    restaurant_name TEXT,
    restaurant_location TEXT,
    restaurant_rating NUMERIC,
    coherence_index NUMERIC,
    verdict TEXT,
    summary TEXT,
    claims JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS) y permitir lectura/escritura pública con la anon key
ALTER TABLE public.reality_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read reality_checks" ON public.reality_checks;
CREATE POLICY "Allow public read reality_checks" 
ON public.reality_checks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert reality_checks" ON public.reality_checks;
CREATE POLICY "Allow public insert reality_checks" 
ON public.reality_checks FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update reality_checks" ON public.reality_checks;
CREATE POLICY "Allow public update reality_checks" 
ON public.reality_checks FOR UPDATE USING (true) WITH CHECK (true);

-- 2. Tabla opcional para Canales Seguidos en segundo plano (tracked_channels)
CREATE TABLE IF NOT EXISTS public.tracked_channels (
    channel_id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT DEFAULT 'foodies',
    auto_analyze BOOLEAN DEFAULT true,
    added_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tracked_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all access on tracked_channels" ON public.tracked_channels;
CREATE POLICY "Allow public all access on tracked_channels" 
ON public.tracked_channels FOR ALL USING (true) WITH CHECK (true);

-- 4. Tabla para Almacén de Reseñas de Google Maps (caché permanente a coste $0)
CREATE TABLE IF NOT EXISTS public.restaurant_reviews (
    id TEXT PRIMARY KEY,
    restaurant_name TEXT,
    restaurant_location TEXT,
    reviewer_name TEXT,
    stars NUMERIC,
    text TEXT,
    published_at TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.restaurant_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all access on restaurant_reviews" ON public.restaurant_reviews;
CREATE POLICY "Allow public all access on restaurant_reviews" 
ON public.restaurant_reviews FOR ALL USING (true) WITH CHECK (true);

