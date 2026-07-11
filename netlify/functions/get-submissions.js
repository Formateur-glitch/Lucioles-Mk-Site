// Cette fonction tourne côté serveur (jamais visible des visiteurs).
// Elle vérifie que l'appelant est bien connecté (Netlify Identity),
// puis va chercher les vraies inscriptions du formulaire "inscription"
// via l'API Netlify, en utilisant un token secret stocké en variable
// d'environnement (jamais dans le code source).

exports.handler = async function (event, context) {
  const { user } = context.clientContext || {};

  // 1. Vérifier que la personne est bien connectée en admin
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Non autorisé. Veuillez vous connecter." }),
    };
  }

  const NETLIFY_API_TOKEN = process.env.NETLIFY_API_TOKEN;
  const SITE_ID = process.env.SITE_ID;

  if (!NETLIFY_API_TOKEN || !SITE_ID) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Configuration serveur manquante (NETLIFY_API_TOKEN ou SITE_ID).",
      }),
    };
  }

  try {
    // 2. Trouver le formulaire "inscription" du site
    const formsRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${SITE_ID}/forms`,
      { headers: { Authorization: `Bearer ${NETLIFY_API_TOKEN}` } }
    );

    if (!formsRes.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Impossible de contacter l'API Netlify (forms)." }),
      };
    }

    const forms = await formsRes.json();
    const form = forms.find((f) => f.name === "inscription");

    if (!form) {
      // Aucun formulaire détecté pour l'instant (peut-être pas encore de soumission)
      return { statusCode: 200, body: JSON.stringify([]) };
    }

    // 3. Récupérer les soumissions de ce formulaire
    const subsRes = await fetch(
      `https://api.netlify.com/api/v1/forms/${form.id}/submissions`,
      { headers: { Authorization: `Bearer ${NETLIFY_API_TOKEN}` } }
    );

    if (!subsRes.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Impossible de contacter l'API Netlify (submissions)." }),
      };
    }

    const submissions = await subsRes.json();

    // 4. Nettoyer/formater pour le panneau admin
    const cleaned = submissions.map((s) => ({
      id: s.id,
      date: new Date(s.created_at).toLocaleString("fr-FR"),
      prenom: s.data?.prenom || "",
      nom: s.data?.nom || "",
      telephone: s.data?.telephone || "",
      email: s.data?.email || "",
      formule: s.data?.formule || "",
      message: s.data?.message || "",
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(cleaned),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erreur inattendue côté serveur." }),
    };
  }
};
