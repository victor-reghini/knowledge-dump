import fs from 'node:fs';
import path from 'node:path';

/**
 * Escapa texto para inclusão em PDF com codificação WinAnsi
 */
function escapePdfWinAnsi(str) {
  let res = '';
  const buf = Buffer.from(str, 'latin1');
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 0x28) res += '\\(';
    else if (b === 0x29) res += '\\)';
    else if (b === 0x5c) res += '\\\\';
    else if (b < 32 || b >= 127) {
      res += '\\' + b.toString(8).padStart(3, '0');
    } else {
      res += String.fromCharCode(b);
    }
  }
  return res;
}

/**
 * Gera um paper acadêmico válido em PDF 1.4 de 8 páginas (página 7 com citação de Frank Rosenblatt 1958)
 * Implementação pura em Node.js (sem dependências de Python ou binários externos)
 */
export function build8PageAcademicPdf() {
  const pagesData = [
    {
      header: "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
      title: "Princípios de Aprendizado em Redes Neurais e Modelos Lineares",
      authors: "Dr. Frank Rosenblatt, Dra. Maria Silva, Prof. Alan Turing",
      sections: [
        ["1. Resumo & Introdução", 
         "Este artigo investiga os fundamentos matemáticos e empíricos dos classificadores lineares supervisionados, com ênfase no algoritmo do Perceptron e sua extensão para redes de múltiplas camadas. Analisamos detalhadamente a convergência estocástica e as propriedades de separabilidade linear em espaços de alta dimensão."],
        ["1.1 Motivação Histórica",
         "A busca por replicar as faculdades cognitivas humanas através de circuitos conexionistas remonta aos trabalhos pioneiros de McCulloch e Pitts (1943). No entanto, foi com a introdução de ponderações sinápticas dinâmicas e regras de ajuste baseadas em erro que os primeiros autômatos perceptivos demonstraram real capacidade de generalização indutiva."]
      ]
    },
    {
      header: "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
      title: "2. Arquitetura do Modelo Conexionista",
      authors: "",
      sections: [
        ["2.1 Vetores de Entrada e Pesos Sinápticos",
         "Dado um vetor de entrada x pertencente ao espaço R^n e um vetor correspondente de pesos sinápticos w pertencente ao mesmo espaço euclidiano, o potencial de ativação v é computado pelo produto interno entre os dois vetores acrescido de um termo de polarização b (bias)."],
        ["2.2 Funções de Limiar e Ativação",
         "A função limiar de Heaviside introduz uma não-linearidade pontual no espaço de decisão: se v >= 0, a saída computada é 1; caso contrário, a saída é 0 ou -1. Esta regra de decisão divide o espaço n-dimensional através de um hiperplano separador com vetor normal w."]
      ]
    },
    {
      header: "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
      title: "3. Regra de Aprendizado e Otimização do Erro",
      authors: "",
      sections: [
        ["3.1 Formulação do Algoritmo de Atualização",
         "A cada iteração k, o erro e(k) é mensurado pela diferença entre a classe alvo d(k) e a predição y(k). A atualização dos pesos segue a regra de Hebb corrigida: w(k+1) = w(k) + eta * e(k) * x(k), onde eta representa a taxa de aprendizado."],
        ["3.2 Dinâmica de Correção de Erros",
         "A convergência de tais esquemas iterativos depende estritamente da distribuição geométrica dos padrões de treino no politopo convexo delimitado pelas instâncias positivas e negativas."]
      ]
    },
    {
      header: "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
      title: "4. Limitações Estruturais e o Problema do XOR",
      authors: "",
      sections: [
        ["4.1 A Crítica de Minsky e Papert (1969)",
         "Em sua célebre monografia, Minsky e Papert demonstraram analiticamente que funções booleanas não-linearmente separáveis, como a função lógica XOR (OU Exclusivo) e o predicado de conectividade geométrica, são indecidíveis por um único neurônio linear."],
        ["4.2 Transição para Redes Multicamadas",
         "A superação deste gargalo representacional exige a inserção de camadas ocultas (hidden layers) e funções de ativação contínuas diferenciáveis, abrindo caminho para o algoritmo de retropropagação do gradiente (Backpropagation)."]
      ]
    },
    {
      header: "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
      title: "5. Funções de Ativação Contínuas e Não-Lineares",
      authors: "",
      sections: [
        ["5.1 A Sigmoide Logística e Hiperbólica",
         "A substituição do degrau descontínuo pela curva logística suave sigma(z) = 1 / (1 + e^-z) permitiu o cálculo exato de derivadas direcionais, fundamentando a descida do gradiente descendente em superfícies de custo contínuas."],
        ["5.2 Análise do Gradiente em Camadas Profundas",
         "Discutimos aqui o fenômeno da dispersão do gradiente (vanishing gradient) em arquiteturas profundas e comparamos o comportamento assintótico da função sigmoide com unidades retificadoras lineares (ReLU)."]
      ]
    },
    {
      header: "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
      title: "6. Regularização e Generalização Estatística",
      authors: "",
      sections: [
        ["6.1 Teoria do Aprendizado Estatístico (Vapnik-Chervonenkis)",
         "A capacidade de generalização de um modelo preditivo não depende unicamente de sua minimização de erro empírico na base de treino, mas da dimensão VC da família de funções hipótese."],
        ["6.2 Penalização de Pesos L1 e L2",
         "Adicionar termos de penalização na função de custo (Weight Decay) força a solução ótima a buscar hiperplanos com maiores margens de separação, mitigando riscos de sobreajuste (overfitting)."]
      ]
    },
    {
      header: "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
      title: "7. Teorema da Convergência e Prova Formal",
      authors: "",
      sections: [
        ["7.1 Teorema Fundamental da Convergência do Perceptron",
         "A convergência do Perceptron é garantida se o conjunto for linearmente separável. Sob a hipótese de existência de um vetor de pesos ótimo w* com margem gamma > 0 e limitante de norma superior R para todos os exemplos x_i, o número total de atualizações de erro antes da estabilização finita é limitado superiormente por (R / gamma)^2."],
        ["7.2 Implicações Práticas da Prova",
         "Este resultado formal assegura que, em problemas estritamente separáveis, o tempo de treinamento é estritamente finito e independente da ordem de apresentação das amostras no laço principal de épocas."]
      ]
    },
    {
      header: "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
      title: "8. Conclusão e Referências Bibliográficas",
      authors: "",
      sections: [
        ["8.1 Considerações Finais",
         "O Perceptron permanece como alicerce epistemológico da inteligência artificial moderna, unindo simplicidade conceitual com garantias teóricas rigorosas de convergência linear."],
        ["Referências",
         "[1] Rosenblatt, F. (1958). The Perceptron: A Probabilistic Model for Information Storage and Organization in the Brain. Psychological Review, 65(6), 386-408.\n[2] Minsky, M., & Papert, S. (1969). Perceptrons: An Introduction to Computational Geometry. MIT Press.\n[3] Rumelhart, D. E., Hinton, G. E., & Williams, R. J. (1986). Learning representations by back-propagating errors. Nature, 323, 533-536."]
      ]
    }
  ];

  const pageCount = pagesData.length;
  const kids = [];
  for (let i = 0; i < pageCount; i++) {
    kids.push(`${5 + 2 * i} 0 R`);
  }

  const objects = [];
  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageCount} >>\nendobj\n`;
  objects[3] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`;
  objects[4] = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`;

  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    const page = pagesData[i];
    const pageObjNum = 5 + 2 * i;
    const streamObjNum = 6 + 2 * i;

    const commands = [];
    // Header
    commands.push(`BT /F2 8 Tf 54 756 Td (${escapePdfWinAnsi(page.header)}) Tj ET`);
    commands.push(`BT /F1 8 Tf 490 756 Td (Pág. ${pageNum} de ${pageCount}) Tj ET`);
    commands.push(`0.5 w 54 750 m 558 750 l S`);

    // Title
    commands.push(`BT /F2 15 Tf 54 710 Td (${escapePdfWinAnsi(page.title)}) Tj ET`);

    let y = 680;
    if (page.authors) {
      commands.push(`BT /F1 10 Tf 54 ${y} Td (${escapePdfWinAnsi(page.authors)}) Tj ET`);
      y -= 26;
    }

    for (const [secTitle, secText] of page.sections) {
      commands.push(`BT /F2 11 Tf 54 ${y} Td (${escapePdfWinAnsi(secTitle)}) Tj ET`);
      y -= 16;

      const words = secText.split(/\s+/);
      let line = '';
      for (const w of words) {
        if ((line + ' ' + w).length > 80) {
          commands.push(`BT /F1 9.5 Tf 54 ${y} Td (${escapePdfWinAnsi(line.trim())}) Tj ET`);
          y -= 13;
          line = w;
        } else {
          line += (line ? ' ' : '') + w;
        }
      }
      if (line.trim()) {
        commands.push(`BT /F1 9.5 Tf 54 ${y} Td (${escapePdfWinAnsi(line.trim())}) Tj ET`);
        y -= 22;
      }
    }

    // Footer
    commands.push(`0.5 w 54 45 m 558 45 l S`);
    commands.push(`BT /F1 8 Tf 54 32 Td (Knowledge Dump - Acervo Científico & Documentação Soberana) Tj ET`);
    commands.push(`BT /F1 8 Tf 500 32 Td (Página ${pageNum}) Tj ET`);

    const streamContent = commands.join('\n');
    const streamLen = Buffer.byteLength(streamContent, 'utf8');

    objects[pageObjNum] = `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamObjNum} 0 R >>\nendobj\n`;
    objects[streamObjNum] = `${streamObjNum} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
  }

  let pdf = '%PDF-1.4\n%âãÏÓ\n';
  const offsets = [0];

  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, 'utf8');
    pdf += objects[i];
  }

  const startXref = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < objects.length; i++) {
    const offStr = String(offsets[i]).padStart(10, '0');
    pdf += `${offStr} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

/**
 * Cria um arquivo ZIP simples em Buffer (para DOCX)
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
    header.writeUInt32LE(0, 14); // crc32
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

/**
 * Gera o Buffer binário do documento DOCX de exemplo
 */
export function buildSampleDocx() {
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

  return createSimpleZip({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
    'word/document.xml': docXml
  });
}

/**
 * Gera o conteúdo em texto do arquivo LaTeX de exemplo
 */
export function buildSampleTex() {
  return `\\documentclass[11pt,a4paper]{article}
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
}

/**
 * Gera e assegura a existência das fixtures de referências nos diretórios indicados
 */
export function generateAllFixtures(targetDirs = []) {
  const pdfBuf = build8PageAcademicPdf();
  const docxBuf = buildSampleDocx();
  const texContent = buildSampleTex();

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const pdfPath = path.join(dir, 'rosenblatt1958_perceptron.pdf');
    const docxPath = path.join(dir, 'relatorio_redes_neurais.docx');
    const texPath = path.join(dir, 'hopfield1982_redes.tex');

    fs.writeFileSync(pdfPath, pdfBuf);
    fs.writeFileSync(docxPath, docxBuf);
    fs.writeFileSync(texPath, texContent, 'utf8');

    console.log(`✅ Fixtures geradas em: ${dir} (PDF: ${pdfBuf.length}b, DOCX: ${docxBuf.length}b, TeX: ${texContent.length}b)`);
  }
}

// Execução padrão via CLI
const defaultDataDir = path.resolve(process.cwd(), 'data', 'references');
const defaultFixturesDir = path.resolve(process.cwd(), 'fixtures', 'references');
generateAllFixtures([defaultDataDir, defaultFixturesDir]);
