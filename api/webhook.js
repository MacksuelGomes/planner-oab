import admin from 'firebase-admin';
import nodemailer from 'nodemailer';

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

export default async function handler(req, res) {
  // A Vercel usa 'req.method' em vez de 'event.httpMethod'
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // A Vercel já entrega o corpo da requisição (body) pronto, não precisa de JSON.parse
    const data = req.body;

    if (data.type === 'checkout.session.completed') {
      const customerEmail = data.data.object.customer_details.email;
      const customerName = data.data.object.customer_details.name || "Futuro Advogado(a)";
      
      console.log(`Venda aprovada para: ${customerEmail}`);

      // A. Salva no Banco de Dados
      await db.collection('vendas_aprovadas').add({
        email: customerEmail,
        data_venda: new Date().toISOString(),
        origem: 'Stripe via Vercel',
        status: 'aprovado'
      });

      // B. Configuração do E-mail (Gmail ou Profissional)
      // Se você não definir HOST e PORT, ele tenta usar o Gmail por padrão
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || "smtp.gmail.com",
        port: process.env.EMAIL_PORT || 465,
        secure: true, // true para porta 465, false para outras
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      // C. Envia o E-mail
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
            <p>Bons estudos!<br>Equipe Meu Planner OAB</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log("E-mail enviado!");

      return res.status(200).json({ message: "Sucesso!" });
    }

    return res.status(200).send("Evento recebido.");

  } catch (error) {
    console.error("Erro:", error);
    return res.status(500).send("Erro interno.");
  }
}
