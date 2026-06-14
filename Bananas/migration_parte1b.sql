-- ============================================================
-- PARTE 1B: button_config + inventario_embolse (re-run corregido)
-- ============================================================

-- ALTER button_config (agregar columnas de color/semana)
ALTER TABLE button_config
  ADD COLUMN IF NOT EXISTS color_id uuid,
  ADD COLUMN IF NOT EXISTS color_name text,
  ADD COLUMN IF NOT EXISTS color_hex text,
  ADD COLUMN IF NOT EXISTS week_age integer;

-- button_config
INSERT INTO button_config (id, button_name, button_label, color_hex, week_age, active, position) VALUES
  ('c55df6e4-64e6-430c-8e2d-9e312b6c07c6', 'BLANCA', 'BLANCA', '#f4f1f1', 9, true, 5),
  ('bce4a8ab-117f-4004-802b-99a4d99b00d6', 'AZUL', 'AZUL', '#00afee', 10, true, 4),
  ('9707b341-21d8-4436-a53d-d51332ef22cc', 'NARANJA', 'NARANJA', '#febf00', 11, true, 3),
  ('29f52618-4445-490f-9c4d-d7903d79f93b', 'CAFES', 'CAFES', '#cc6600', 12, true, 2),
  ('add8f2f1-0b86-4d92-8d0e-1f5bdd6c961f', 'MORADA', 'MORADA', '#8b3691', 13, true, 1)
ON CONFLICT DO NOTHING;

-- actualizar color_id en button_config desde color_configs
UPDATE button_config
SET color_id = color_configs.id
FROM color_configs
WHERE button_config.color_name = color_configs.color_name
  AND button_config.color_id IS NULL;

-- inventario_embolse (semana=TEXT, color_id via subquery)
INSERT INTO inventario_embolse (id, semana, color_id, color_name, color_hex, total, cosechado, perdidas, saldo) VALUES
  ('18f7bbb6-7561-4a9c-923d-cc3a09013afc', '24', (SELECT id FROM color_configs WHERE color_name='CAFES' LIMIT 1), 'CAFES', '#cc6600', 0, 0, 0, 0),
  ('1249fe5d-d89c-4b4a-9092-21f847607944', '23', (SELECT id FROM color_configs WHERE color_name='MORADA' LIMIT 1), 'MORADA', '#8b3691', 4645, 0, 0, 4645),
  ('c808e14a-4102-4050-8bdd-71d8fe9384a0', '22', (SELECT id FROM color_configs WHERE color_name='VERDE' LIMIT 1), 'VERDE', '#37d23a', 4383, 0, 0, 4383),
  ('033b3299-11c1-47d5-9ab4-d771f7987ef7', '21', (SELECT id FROM color_configs WHERE color_name='PLATA' LIMIT 1), 'PLATA', '#949494', 4833, 0, 0, 4833),
  ('31f3b962-1ec5-49f0-b9b0-4494ddb7822d', '20', (SELECT id FROM color_configs WHERE color_name='ROJO' LIMIT 1), 'ROJO', '#fb0404', 4848, 0, 0, 4848),
  ('01948486-2328-4cba-bca3-b00609bd00eb', '19', (SELECT id FROM color_configs WHERE color_name='NEGRA' LIMIT 1), 'NEGRA', '#000000', 5195, 0, 14, 5181),
  ('4535eb63-fe59-4421-9f5c-206647e6f736', '18', (SELECT id FROM color_configs WHERE color_name='AMARILLA' LIMIT 1), 'AMARILLA', '#ffff00', 5790, 0, 8, 5782),
  ('143faa0c-a7e4-464a-bcf9-c6057499de1c', '17', (SELECT id FROM color_configs WHERE color_name='BLANCA' LIMIT 1), 'BLANCA', '#f4f1f1', 6152, 15, 17, 6120),
  ('dc4d4fef-2a97-4a1d-bc5e-9b4bc2bab6a4', '16', (SELECT id FROM color_configs WHERE color_name='AZUL' LIMIT 1), 'AZUL', '#00afee', 6235, 980, 6, 5249),
  ('6564b3c9-217e-41db-b311-106aa63f5aef', '15', (SELECT id FROM color_configs WHERE color_name='NARANJA' LIMIT 1), 'NARANJA', '#febf00', 6610, 4711, 305, 1594),
  ('1c72ca2b-6abe-4877-8aee-1701252d1fbc', '14', (SELECT id FROM color_configs WHERE color_name='CAFES' LIMIT 1), 'CAFES', '#cc6600', 6295, 3057, 3103, 135),
  ('c0cb5a04-c609-4cd3-baaf-01678bbaba4f', '13', (SELECT id FROM color_configs WHERE color_name='MORADA' LIMIT 1), 'MORADA', '#8b3691', 8123, 1952, 6089, 82),
  ('8118889a-1930-415b-9562-69a2dde36fb2', '12', (SELECT id FROM color_configs WHERE color_name='VERDE' LIMIT 1), 'VERDE', '#37d23a', 8355, 231, 8063, 61),
  ('63b36fb3-2f4a-4182-89a1-bf6e3b710608', '11', (SELECT id FROM color_configs WHERE color_name='PLATA' LIMIT 1), 'PLATA', '#949494', 7940, 0, 7918, 22),
  ('27b5569a-6894-4d04-b2e8-163e1d9e2645', '10', (SELECT id FROM color_configs WHERE color_name='ROJO' LIMIT 1), 'ROJO', '#fb0404', 6846, 0, 6830, 16),
  ('fba0c742-cd0f-476e-b4c3-0a26646a0722', '9', (SELECT id FROM color_configs WHERE color_name='NEGRA' LIMIT 1), 'NEGRA', '#000000', 6658, 0, 6659, -1),
  ('f123428c-4cd6-4040-9a9b-f0188d7d53a6', '8', (SELECT id FROM color_configs WHERE color_name='AMARILLA' LIMIT 1), 'AMARILLA', '#ffff00', 5749, 0, 5742, 7),
  ('e951cca6-ad6b-444d-8447-d69c7a3f330f', '7', (SELECT id FROM color_configs WHERE color_name='BLANCA' LIMIT 1), 'BLANCA', '#f4f1f1', 4696, 0, 4660, 36),
  ('377c404e-6d21-4242-9fed-431d98490460', '6', (SELECT id FROM color_configs WHERE color_name='AZUL' LIMIT 1), 'AZUL', '#00afee', 5096, 0, 5116, -20),
  ('037ef654-035a-4a77-8909-1aac47a36638', '5', (SELECT id FROM color_configs WHERE color_name='NARANJA' LIMIT 1), 'NARANJA', '#febf00', 4523, 0, 4493, 30),
  ('9aa5c119-75ee-49b0-9f68-e663e39ff2f0', '4', (SELECT id FROM color_configs WHERE color_name='CAFES' LIMIT 1), 'CAFES', '#cc6600', 4449, 0, 4424, 25),
  ('fcc0cb80-61a7-4c0d-acb7-a8a487415776', '3', (SELECT id FROM color_configs WHERE color_name='MORADA' LIMIT 1), 'MORADA', '#8b3691', 3926, 0, 3934, -8),
  ('974eaf6b-0040-4fbc-815c-d2ce154a2c54', '2', (SELECT id FROM color_configs WHERE color_name='VERDE' LIMIT 1), 'VERDE', '#37d23a', 4467, 0, 4457, 10),
  ('1d141ecb-63f0-4a72-87f7-5ce782f9582d', '1', (SELECT id FROM color_configs WHERE color_name='PLATA' LIMIT 1), 'PLATA', '#949494', 3434, 0, 3418, 16)
ON CONFLICT DO NOTHING;
