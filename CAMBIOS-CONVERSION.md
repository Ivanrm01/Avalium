# Cambios de conversión y calculadora (octubre de 2026)

Resumen técnico de lo que se ha tocado y de lo que tienes que hacer tú para dejarlo funcionando.

## 1. Qué hay de nuevo

| Pieza | Archivo | Qué hace |
|--|--|--|
| Eventos de conversión | `assets/conversion.js` | Envía a Google Analytics `generate_lead`, `click_to_call`, `click_email`, `lead_form_start` y `cta_click`. Nunca envía nombre, teléfono ni email. |
| Barra fija en móvil | `assets/conversion.js` + `styles.css` | Botones «Llamar ahora» y «Te llamamos» abajo de la pantalla en móvil (≤ 900 px). |
| Formulario corto | portada, 4 páginas de servicio, casos de éxito, contacto, artículos del blog | Nombre, teléfono, importe y urgencia + aceptación de privacidad. En Contacto se pueden añadir email y mensaje (opcional). |
| Promesa de llamada | formularios y emails | «Te llamamos hoy si es urgente»: urgente = embargos, providencia de apremio o plazo de recurso; de lunes a viernes antes de las 17:00 (hora de Madrid). Fuera de ese horario el mensaje dice «a primera hora del próximo día laborable». |
| API de contacto | `api/contact.js` + `api/_lib/mail.js` | Acepta el formulario corto, escapa todo el HTML, antispam (campo trampa + tiempo mínimo + límite por IP), TLS obligatorio. Asunto «🔴 URGENTE · LLAMAR HOY» en los casos urgentes. Funciona también sin JavaScript. |
| Calculadora pública | `calculadora-garantia-aeat.html` | Aplazamiento/fraccionamiento y suspensión. Muestra el importe a garantizar, el valor mínimo del inmueble y el plazo máximo; el informe completo se envía por email. |
| Motor de cálculo | `assets/calc-garantias.js` | Un único motor para la calculadora pública, la interna y el informe por email. Toda la normativa está comentada al principio del archivo. |
| API del informe | `api/calculadora.js` | Recalcula en el servidor, envía el informe al usuario y te avisa del nuevo contacto. |
| Herramienta interna | `admin/calculadora.html` | Usa el mismo motor, corrige la normativa y exporta también el calendario de cuotas. |

## 2. Variables de entorno en Vercel

Las que ya tienes siguen sirviendo (`SMTP_USER`, `SMTP_PASS`). Opcionales nuevas:

- `LEADS_TO`: dirección donde quieres recibir los avisos de contactos (por defecto, `SMTP_USER`).
- `SMTP_HOST` / `SMTP_PORT`: solo si cambias de proveedor (por defecto `smtp.ionos.es` y `587`).

## 3. Google Analytics 4: marcar los eventos clave

1. GA4 → Administrar → Visualización de datos → Eventos.
2. Cuando aparezcan (tras la primera conversión real o una prueba), marca como **evento clave**: `generate_lead` y `click_to_call` (y `click_email` si quieres).
3. Para ver de dónde vienen los contactos, crea dimensiones personalizadas de evento (Administrar → Definiciones personalizadas): `lead_source`, `form_location`, `link_location`, `urgencia`, `importe_rango`, `calc_modo`.
4. Si haces campañas de Google Ads, importa `generate_lead` y `click_to_call` como conversiones.

Recuerda: Analytics solo mide a quien acepta las cookies analíticas. El número real de contactos es el de emails recibidos.

## 4. Cuándo revisar la calculadora

Los datos que cambian están en `NORMATIVA`, al principio de `assets/calc-garantias.js`:

- `interesLegal` e `interesDemora`: cambian cuando se apruebe una nueva Ley de Presupuestos (hoy, 3,25 % y 4,0625 % de la LPGE 2023 prorrogada).
- `limiteExento`: si una nueva orden cambia los 50.000 €.
- `plazosMax`: si el Departamento de Recaudación sustituye la Instrucción 2/2023.
- `coberturaBien`: si se modifica la Instrucción 1/2023 de garantías.
- `revision`: el texto «octubre de 2026» que aparece en la web y en los informes.

Para comprobar el motor: `node` y `require('./assets/calc-garantias.js').calcularAplazamiento({ deuda: 200000, meses: 24, modalidad: 'aplazamiento', garantia: 'urbano_libre' })` debe dar 270.312,50 € a garantizar.
