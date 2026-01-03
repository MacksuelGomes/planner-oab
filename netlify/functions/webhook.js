const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// 1. Configuração do Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    })
  });
}

const db = admin.firestore();

// 2. Configuração do E-mail (O Carteiro)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);

    if (data.type === 'checkout.session.completed') {
      const customerEmail = data.data.object.customer_details.email;
      const customerName = data.data.object.customer_details.name || "Futuro Advogado(a)";
      
      console.log(`Venda aprovada para: ${customerEmail}`);

      // A. Salva no Banco de Dados
      await db.collection('vendas_aprovadas').add({
        email: customerEmail,
        data_venda: new Date().toISOString(),
        origem: 'Stripe Automático',
        status: 'aprovado'
      });

      // B. Envia o E-mail de Boas-vindas
      const mailOptions = {
        from: `"Meu Planner OAB" <${process.env.EMAIL_USER}>`,
        to: customerEmail,
        subject: 'Acesso Liberado! 🚀 Comece seus estudos agora',
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2>Parabéns, ${customerName}!</h2>
            <p>Seu pagamento foi confirmado e seu acesso ao <strong>Meu Planner OAB</strong> já está liberado.</p>
            <p>Para acessar, clique no botão abaixo e crie sua conta usando este mesmo e-mail:</p>
            <br>
            <a href="https://appmeuplanneroab.com.br/login.html" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">ACESSAR PLATAFORMA AGORA</a>
            <br><br>
            <p>Se tiver qualquer dúvida, responda este e-mail.</p>
            <p>Bons estudos!<br>Equipe Meu Planner OAB</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log("E-mail de boas-vindas enviado!");

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Acesso liberado e e-mail enviado!" }),
      };
    }

    return { statusCode: 200, body: "Evento recebido." };

  } catch (error) {
    console.error("Erro:", error);
    return { statusCode: 500, body: "Erro interno." };
  }
};
