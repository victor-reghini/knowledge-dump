import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const REFS_DIR = path.resolve(process.cwd(), 'data', 'references');
if (!fs.existsSync(REFS_DIR)) {
  fs.mkdirSync(REFS_DIR, { recursive: true });
}

/**
 * Cria um arquivo ZIP simples em Buffer (usando método 0 - STORE ou deflate)
 */
function createSimpleZip(files) {
  const fileEntries = [];
  let offset = 0;

  for (const [filename, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const nameBuf = Buffer.from(filename, 'utf8');
    const header = Buffer.alloc(30 + nameBuf.length);

    header.writeUInt32LE(0x04034b50, 0); // signature PK\x03\x04
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0, 6); // flags
    header.writeUInt16LE(0, 8); // compression method 0 (stored)
    header.writeUInt16LE(0, 10); // time
    header.writeUInt16LE(0, 12); // date
    header.writeUInt32LE(0, 14); // crc32 (opcional p/ store)
    header.writeUInt32LE(data.length, 18); // compressed size
    header.writeUInt32LE(data.length, 22); // uncompressed size
    header.writeUInt16LE(nameBuf.length, 26); // file name length
    header.writeUInt16LE(0, 28); // extra field length
    nameBuf.copy(header, 30);

    fileEntries.push({ header, data, name: filename, offset });
    offset += header.length + data.length;
  }

  return Buffer.concat(fileEntries.flatMap(e => [e.header, e.data]));
}

// 1. Gera DOCX de Exemplo
const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/></w:pPr>
      <w:r><w:t>Relatório Técnico: Avanços em Redes Neurais e Deep Learning</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>1. Introdução e Contexto Histórico</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Os modelos conexionistas ganharam notoriedade através do </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Perceptron de Rosenblatt (1958)</w:t></w:r>
      <w:r><w:t>, seguido pela introdução da retropropagação do erro.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>2. Metodologia e Resultados</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Os ensaios demonstraram que funções de ativação não lineares como </w:t></w:r>
      <w:r><w:rPr><w:i/></w:rPr><w:t>ReLU e GELU</w:t></w:r>
      <w:r><w:t> mitigam o problema do desaparecimento de gradientes em arquiteturas profundas.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:numPr/></w:pPr>
      <w:r><w:t>Avaliação de convergência assintótica em 10.000 épocas de treinamento.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:numPr/></w:pPr>
      <w:r><w:t>Verificação de robustez contra ataques adversariais em imagens.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

const docxBuffer = createSimpleZip({
  '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
  'word/document.xml': docXml
});

const docxPath = path.join(REFS_DIR, 'relatorio_redes_neurais.docx');
fs.writeFileSync(docxPath, docxBuffer);
console.log(`✅ Arquivo DOCX gerado em: ${docxPath}`);

// 2. Gera TeX (LaTeX) de Exemplo
const texContent = `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb}
\\usepackage{hyperref}

\\title{Redes de Hopfield e Memória Associativa Auto-organizável}
\\author{John J. Hopfield \\and Pesquisadores Associados}
\\date{1982}

\\begin{document}

\\maketitle

\\begin{abstract}
Este trabalho formaliza a dinâmica de sistemas neurais com conexões simétricas recorrentes e formulação energética baseada no modelo de Ising da mecânica estatística. Demonstramos que o sistema converge monotonicamente para mínimos locais de uma função de energia de Liapunov.
\\end{abstract}

\\section{Introdução}
Modelos conexionistas recorrentes possuem capacidade inerente de recuperação de padrões ruidosos através de dinâmica de atratores. A energia do sistema é dada por:

\\begin{equation}
E = -\\frac{1}{2} \\sum_{i=1}^{N} \\sum_{j=1}^{N} w_{ij} s_i s_j - \\sum_{i=1}^{N} \\theta_i s_i
\\end{equation}

onde $w_{ij}$ representa o peso sináptico simétrico entre os neurônios $i$ e $j$ ($w_{ij} = w_{ji}$, com $w_{ii} = 0$), $s_i \\in \\{-1, +1\\}$ é o estado binário de ativação, e $\\theta_i$ é o limiar de disparo.

\\section{Regra de Aprendizado Hebbiano}
Para armazenar $P$ padrões ortogonais $\\xi^{\\mu}$, os pesos são definidos pela regra hebbiana clássica:

\\begin{equation}
w_{ij} = \\frac{1}{N} \\sum_{\\mu=1}^{P} \\xi_i^{\\mu} \\xi_j^{\\mu}
\\end{equation}

A capacidade teórica de armazenamento estável sem saturação é estimada em $P_{max} \\approx 0.14 N$.

\\section{Conclusões}
A formulação energética estabelece uma ponte entre física estatística e inteligência artificial computacional.

\\end{document}
`;

const texPath = path.join(REFS_DIR, 'hopfield1982_redes.tex');
fs.writeFileSync(texPath, texContent, 'utf8');
console.log(`✅ Arquivo TeX (LaTeX) gerado em: ${texPath}`);
