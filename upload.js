/* Script upload.js */
const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parser');
const serviceAccount = require('./serviceAccountKey.json');
const csvFilePath = './questoes.csv';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const questoesRef = db.collection('questoes');

console.log('A iniciar a importação do arquivo:', csvFilePath);

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', async (row) => {
    try {
      const questaoData = {
        materia: row.materia || '',
        edicao: row.edicao || '',
        tema: row.tema || '',
        enunciado: row.enunciado || 'Enunciado não fornecido',
        alternativas: {
          A: row.alt_a || '', B: row.alt_b || '',
          C: row.alt_c || '', D: row.alt_d || ''
        },
        correta: row.correta || '',
        comentario: row.comentario || ''
      };

      const docRef = questoesRef.doc(); 
      questaoData.id = docRef.id;       

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