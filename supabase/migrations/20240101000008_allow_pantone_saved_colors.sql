-- Allow Pantone colors to be saved. The original saved_colors CHECK constraint
-- only permitted 'NCS' and 'RAL', so saving a palette/Pantone color failed with a
-- constraint violation (see PaletteColorModal.svelte -> saved-colors.ts).
ALTER TABLE saved_colors DROP CONSTRAINT IF EXISTS saved_colors_color_system_check;
ALTER TABLE saved_colors ADD CONSTRAINT saved_colors_color_system_check
  CHECK (color_system IN ('NCS', 'RAL', 'Pantone'));
