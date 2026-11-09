ALTER TABLE public.registros
  DROP CONSTRAINT registros_estado_check,
  ADD CONSTRAINT registros_estado_check
    CHECK (
      estado IN (
        'Pendiente',
        'Aprobado',
        'Rechazado',
        'Con expediente NP',
        'Volver a confirmar'
      )
    );

ALTER TABLE public.historial_estados
  DROP CONSTRAINT historial_estados_estado_nuevo_check,
  ADD CONSTRAINT historial_estados_estado_nuevo_check
    CHECK (
      estado_nuevo IN (
        'Pendiente',
        'Aprobado',
        'Rechazado',
        'Con expediente NP',
        'Volver a confirmar'
      )
    );

CREATE OR REPLACE FUNCTION public.ecus_editar_registro(
  p_token_admin text,
  p_registro bigint,
  p_nombre text,
  p_identificacion text,
  p_fecha date,
  p_nacionalidad text,
  p_distrito text,
  p_otro_distrito text,
  p_lugar text,
  p_estado text,
  p_observaciones text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_admin BIGINT;
  v_anterior TEXT;
BEGIN
  v_admin := public.ecus_id_admin(p_token_admin);
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Acceso administrativo vencido o inválido';
  END IF;

  IF p_estado NOT IN (
    'Pendiente',
    'Aprobado',
    'Rechazado',
    'Con expediente NP',
    'Volver a confirmar'
  ) THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;

  IF length(btrim(COALESCE(p_nombre, ''))) < 2
    OR length(btrim(COALESCE(p_identificacion, ''))) < 2
    OR length(btrim(COALESCE(p_lugar, ''))) < 2 THEN
    RAISE EXCEPTION 'Faltan datos obligatorios';
  END IF;

  SELECT estado
  INTO v_anterior
  FROM public.registros
  WHERE id = p_registro
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro inexistente';
  END IF;

  UPDATE public.registros
  SET nombre_completo = upper(btrim(p_nombre)),
      identificacion = upper(btrim(p_identificacion)),
      fecha_nacimiento = p_fecha,
      nacionalidad = upper(btrim(COALESCE(p_nacionalidad, ''))),
      distrito = upper(btrim(p_distrito)),
      otro_distrito = CASE
        WHEN upper(btrim(p_distrito)) = 'OTRO'
          THEN nullif(upper(btrim(COALESCE(p_otro_distrito, ''))), '')
        ELSE NULL
      END,
      lugar_consulta = upper(btrim(p_lugar)),
      estado = p_estado,
      observaciones = nullif(upper(btrim(COALESCE(p_observaciones, ''))), '')
  WHERE id = p_registro;

  INSERT INTO public.ecus_auditoria(registro_id, administrador_id, accion)
  VALUES (
    p_registro,
    v_admin,
    'MODIFICÓ REGISTRO: ' || v_anterior || ' → ' || p_estado
  );
END;
$function$;
