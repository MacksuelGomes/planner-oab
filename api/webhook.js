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
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const data = req.body;

    if (data.type === 'checkout.session.completed') {
      const customerEmail = data.data.object.customer_details.email;
      const customerName = data.data.object.customer_details.name || "Futuro Advogado(a)";
      
      console.log(`Venda aprovada para: ${customerEmail}`);

      // A. Gera uma senha provisória aleatória (Ex: OAB123456)
      const senhaProvisoria = "OAB" + Math.floor(100000 + Math.random() * 900000);
      let mensagemSenha = "";

      // B. Tenta Criar o Usuário no Firebase Auth
      try {
        await admin.auth().createUser({
          email: customerEmail,
          emailVerified: true,
          password: senhaProvisoria,
          displayName: customerName,
          disabled: false
        });
        
        // Se criou com sucesso, a mensagem do e-mail terá a senha
        mensagemSenha = `
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Seus dados de acesso:</strong></p>
            <p style="margin: 5px 0;">📧 Login: ${customerEmail}</p>
            <p style="margin: 0;">🔑 Senha Provisória: <strong>${senhaProvisoria}</strong></p>
          </div>
          <p style="font-size: 12px; color: #666;">Recomendamos que você altere essa senha no seu primeiro acesso.</p>
        `;

        console.log("Usuário criado no Auth com sucesso!");

      } catch (error) {
        if (error.code === 'auth/email-already-exists') {
          console.log("Usuário já existe, enviando e-mail sem senha nova.");
          mensagemSenha = `
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Você já tem cadastro!</strong></p>
              <p style="margin: 5px 0;">Use seu e-mail e senha antiga para acessar.</p>
              <p style="margin: 0;"><a href="https://planner-oab.vercel.app/esqueci-senha.html">Esqueceu a senha? Clique aqui.</a></p>
            </div>
          `;
        } else {
          throw error; // Se for outro erro, joga pra cima
        }
      }

      // C. Salva no Banco de Dados (Firestore) para histórico
      await db.collection('vendas_aprovadas').add({
        email: customerEmail,
        nome: customerName,
        data_venda: new Date().toISOString(),
        origem: 'Stripe Automático',
        status: 'aprovado'
      });

      // D. Configuração do E-mail (Gmail)
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true, 
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      // E. Envia o E-mail
      const mailOptions = {
        from: `"Meu Planner OAB" <${process.env.EMAIL_USER}>`,
        to: customerEmail,
        subject: 'Acesso Liberado! 🚀 Aqui estão seus dados',
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
            <h2>Parabéns, ${customerName}!</h2>
            <p>Seu pagamento foi confirmado e sua conta foi criada automaticamente.</p>
            
            ${mensagemSenha}
            
            <br>
            <center>
              <a href="https://appmeuplanneroab.com.br/login.html" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">ACESSAR PLATAFORMA AGORA</a>
            </center>
            <br><br>
            <p>Bons estudos!<br>Equipe Meu Planner OAB</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log("E-mail com credenciais enviado!");

      return res.status(200).json({ message: "Sucesso! Usuário criado e e-mail enviado." });
    }

    return res.status(200).send("Evento recebido.");

  } catch (error) {
    console.error("Erro:", error);
    return res.status(500).send("Erro interno.");
  }
}
