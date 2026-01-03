const admin = require('firebase-admin');

// Configuração segura com variáveis de ambiente
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Corrige a formatação da chave privada (quebras de linha) para funcionar no Netlify
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    })
  });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  // Apenas aceita requisições POST (que vêm da Stripe)
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);

    // Verifica se o evento é "checkout.session.completed"
    if (data.type === 'checkout.session.completed') {
      const customerEmail = data.data.object.customer_details.email;
      
      console.log(`Venda aprovada para: ${customerEmail}`);

      // Salva na coleção "vendas_aprovadas" no Firestore
      await db.collection('vendas_aprovadas').add({
        email: customerEmail,
        data_venda: new Date().toISOString(),
        origem: 'Stripe Automático',
        status: 'aprovado'
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Acesso liberado com sucesso!" }),
      };
    }

    return { statusCode: 200, body: "Evento recebido, mas não é uma venda finalizada." };

  } catch (error) {
    console.error("Erro no processamento:", error);
    return { statusCode: 500, body: "Erro interno no servidor." };
  }
};
