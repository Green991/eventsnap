# 🔐 Configurar CORS en Firebase Storage

El error **"Failed to fetch"** al descargar el ZIP ocurre porque Firebase Storage bloquea las descargas desde tu web (Netlify) por seguridad. Necesitamos decirle a Firebase que tu web es segura.

Sigue estos pasos (tardarás 2 minutos):

### Pasos

1.  Ve a la [Consola de Google Cloud](https://console.cloud.google.com/).
2.  Asegúrate de que estás en el proyecto correcto: **eventsnap-fefcc** (mira arriba a la izquierda).
3.  Haz clic en el icono de **Activar Cloud Shell** (el icono de terminal `>_` arriba a la derecha).
4.  Espera a que cargue la terminal en la parte inferior.
5.  Sube el archivo `cors.json` que he creado en tu proyecto:
    *   En la terminal de Cloud Shell, haz clic en el botón de tres puntos `⋮` (o "Más") -> **Subir archivo**.
    *   Selecciona el archivo `cors.json` que está en tu carpeta del proyecto (`c:\...\EventSnap DEV\cors.json`).
6.  Una vez subido, ejecuta este comando en la terminal:

```bash
gsutil cors set cors.json gs://eventsnap-fefcc.firebasestorage.app
```

*(Si te da error diciendo que el bucket no existe, prueba con `gs://eventsnap-fefcc.appspot.com` - a veces Firebase usa uno u otro).*

7.  ¡Listo! Espera unos minutos y prueba a descargar el ZIP de nuevo.
