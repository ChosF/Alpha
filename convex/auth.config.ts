/**
 * Convex Auth usa el propio despliegue como emisor de identidad. CONVEX_SITE_URL
 * la define Convex de forma automatica en cada despliegue.
 */
const configuracion = {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};

export default configuracion;
