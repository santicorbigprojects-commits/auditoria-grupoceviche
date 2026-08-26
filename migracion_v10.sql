-- ============================================================
-- MIGRACIÓN v10 — Rol VISUALIZADOR (solo lectura, todos los locales)
-- Sistema de auditorías Grupo Ceviche
-- REVISAR Y EJECUTAR MANUALMENTE en Supabase SQL Editor
-- REGLA: solo toca objetos con prefijo au_. Nada más.
--
-- Añade el rol VISUALIZADOR a au_usuarios (además de AUDITOR/DIRECTOR/
-- ADMIN) y da de alta a Manuel (A00032) con ese rol. El código ya trata
-- VISUALIZADOR como "ve todos los locales, igual que ADMIN, pero sin
-- ningún botón de editar/eliminar en ninguna pantalla".
-- ============================================================

ALTER TABLE au_usuarios DROP CONSTRAINT au_usuarios_rol_check;
ALTER TABLE au_usuarios ADD CONSTRAINT au_usuarios_rol_check
  CHECK (rol IN ('AUDITOR','DIRECTOR','ADMIN','VISUALIZADOR'));

INSERT INTO au_usuarios (cut, nombre, rol, activo) VALUES
  ('A00032', 'Manuel', 'VISUALIZADOR', true)
ON CONFLICT (cut) DO UPDATE SET rol = EXCLUDED.rol, activo = true;
