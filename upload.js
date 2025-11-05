/*
 * ========================================================
 * SCRIPT DE CARGA MASSIVA DE QUESTÕES
 * ========================================================
 * Como usar:
 * 1. Instale os pacotes: npm install firebase-admin csv-parser
 * 2. Coloque seu 'serviceAccountKey.json' nesta pasta.
 * 3. Coloque seu 'questoes.csv' nesta pasta.
 * 4. Rode no terminal: node upload.js
 * ========================================================
 */

// 1. Importar as bibliotecas
const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parser');

// 2. Apontar para a sua Chave de Admin
const serviceAccount = require('./serviceAccountKey.json');

// 3. Apontar para o seu arquivo CSV
const csvFilePath = './questoes.csv';

// 4. Inicializar o Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const questoesRef = db.collection('questoes');

console.log('A iniciar a importação do arquivo:', csvFilePath);

// 5. Ler o arquivo CSV
fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', async (row) => {
    try {
      // 6. Formatar os dados da linha do CSV
      const questaoData = {
        materia: row.materia || '',
        edicao: row.edicao || '',
        tema: row.tema || '',
        enunciado: row.enunciado || 'Enunciado não fornecido',
        alternativas: {
          A: row.alt_a || '',
          B: row.alt_b || '',
          C: row.alt_c || '',
          D: row.alt_d || ''
        },
        correta: row.correta || '',
        comentario: row.comentario || ''
      };

      // 7. Criar um ID único e salvar no banco
      const docRef = questoesRef.doc(); // Gera um ID automático
      questaoData.id = docRef.id;       // Adiciona o ID ao documento

      await docRef.set(questaoData);
      
      console.log(`Questão ${questaoData.id} (${questaoData.materia}) adicionada.`);

    } catch (error) {
      console.error('Erro ao salvar a linha:', row, error);
    }
  })
  .on('end', () => {
    console.log('========================================');
    console.log('Importação do CSV concluída com sucesso!');
    console.log('========================================');
  });
