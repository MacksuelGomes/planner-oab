/*
 * ========================================================
 * SCRIPT DE CARGA MASSIVA DE QUESTÕES
 * (VERSÃO 2.1 - Completa)
 * ========================================================
 */

// 1. Importar as bibliotecas
const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path'); // Importa o módulo 'path'

// 2. Apontar para a sua Chave de Admin
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

// 3. Apontar para o seu arquivo CSV
const csvFilePath = path.join(__dirname, 'questoes.csv');

// 4. Inicializar o Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const questoesRef = db.collection('questoes');

console.log('A iniciar a importação do arquivo:', csvFilePath);
console.log('A enviar dados para o Projeto Firebase:', serviceAccount.project_id); // <-- Linha de verificação

// 5. Ler o arquivo CSV
fs.createReadStream(csvFilePath)
  .on('error', (err) => {
    // Erro ao LER o CSV
    console.error('========================================');
    console.error('ERRO AO LER O FICHEIRO CSV!');
    console.error(`Mensagem: ${err.message}`);
    console.error('Verifique se o ficheiro "questoes.csv" está na pasta e com o nome correto.');
    console.error('========================================');
  })
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
      const docRef = questoesRef.doc(); 
      questaoData.id = docRef.id;       

      await docRef.set(questaoData);
      
      // (Vamos mostrar menos mensagens para não poluir)
      // console.log(`Questão ${questaoData.id} (${questaoData.materia}) adicionada.`);

    } catch (error) {
      // Erro ao ENVIAR para o Firebase
      console.error('Erro ao salvar a linha no Firebase:', row, error);
    }
  })
  .on('end', () => {
    console.log('========================================');
    console.log('Importação do CSV concluída com sucesso!');
    console.log('========================================');
  });