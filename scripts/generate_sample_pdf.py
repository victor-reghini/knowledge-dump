import os
import sys
import subprocess

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False

def generate_academic_paper(output_path):
    if not HAS_REPORTLAB:
        print("[Python] reportlab não encontrado. Usando gerador nativo Node.js (scripts/generate_sample_fixtures.js)...")
        script_dir = os.path.dirname(os.path.abspath(__file__))
        js_script = os.path.join(script_dir, "generate_sample_fixtures.js")
        subprocess.run(["node", js_script], check=True)
        return

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    c = canvas.Canvas(output_path, pagesize=letter)
    width, height = letter

    pages_data = [
        # Page 1
        {
            "header": "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
            "title": "Princípios de Aprendizado em Redes Neurais e Modelos Lineares",
            "authors": "Dr. Frank Rosenblatt, Dra. Maria Silva, Prof. Alan Turing",
            "sections": [
                ("1. Resumo & Introdução", 
                 "Este artigo investiga os fundamentos matemáticos e empíricos dos classificadores lineares supervisionados, com ênfase no algoritmo do Perceptron e sua extensão para redes de múltiplas camadas. Analisamos detalhadamente a convergência estocástica e as propriedades de separabilidade linear em espaços de alta dimensão."),
                ("1.1 Motivação Histórica",
                 "A busca por replicar as faculdades cognitivas humanas através de circuitos conexionistas remonta aos trabalhos pioneiros de McCulloch e Pitts (1943). No entanto, foi com a introdução de ponderações sinápticas dinâmicas e regras de ajuste baseadas em erro que os primeiros autômatos perceptivos demonstraram real capacidade de generalização indutiva.")
            ]
        },
        # Page 2
        {
            "header": "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
            "title": "2. Arquitetura do Modelo Conexionista",
            "authors": "",
            "sections": [
                ("2.1 Vetores de Entrada e Pesos Sinápticos",
                 "Dado um vetor de entrada x pertencente ao espaço R^n e um vetor correspondente de pesos sinápticos w pertencente ao mesmo espaço euclidiano, o potencial de ativação v é computado pelo produto interno entre os dois vetores acrescido de um termo de polarização b (bias)."),
                ("2.2 Funções de Limiar e Ativação",
                 "A função limiar de Heaviside introduz uma não-linearidade pontual no espaço de decisão: se v >= 0, a saída computada é 1; caso contrário, a saída é 0 ou -1. Esta regra de decisão divide o espaço n-dimensional através de um hiperplano separador com vetor normal w.")
            ]
        },
        # Page 3
        {
            "header": "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
            "title": "3. Regra de Aprendizado e Otimização do Erro",
            "authors": "",
            "sections": [
                ("3.1 Formulação do Algoritmo de Atualização",
                 "A cada iteração k, o erro e(k) é mensurado pela diferença entre a classe alvo d(k) e a predição y(k). A atualização dos pesos segue a regra de Hebb corrigida: w(k+1) = w(k) + eta * e(k) * x(k), onde eta representa a taxa de aprendizado."),
                ("3.2 Dinâmica de Correção de Erros",
                 "A convergência de tais esquemas iterativos depende estritamente da distribuição geométrica dos padrões de treino no politopo convexo delimitado pelas instâncias positivas e negativas.")
            ]
        },
        # Page 4
        {
            "header": "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
            "title": "4. Limitações Estruturais e o Problema do XOR",
            "authors": "",
            "sections": [
                ("4.1 A Crítica de Minsky e Papert (1969)",
                 "Em sua célebre monografia, Minsky e Papert demonstraram analiticamente que funções booleanas não-linearmente separáveis, como a função lógica XOR (OU Exclusivo) e o predicado de conectividade geométrica, são indecidíveis por um único neurônio linear."),
                ("4.2 Transição para Redes Multicamadas",
                 "A superação deste gargalo representacional exige a inserção de camadas ocultas (hidden layers) e funções de ativação contínuas diferenciáveis, abrindo caminho para o algoritmo de retropropagação do gradiente (Backpropagation).")
            ]
        },
        # Page 5
        {
            "header": "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
            "title": "5. Funções de Ativação Contínuas e Não-Lineares",
            "authors": "",
            "sections": [
                ("5.1 A Sigmoide Logística e Hiperbólica",
                 "A substituição do degrau descontínuo pela curva logística suave sigma(z) = 1 / (1 + e^-z) permitiu o cálculo exato de derivadas direcionais, fundamentando a descida do gradiente descendente em superfícies de custo contínuas."),
                ("5.2 Análise do Gradiente em Camadas Profundas",
                 "Discutimos aqui o fenômeno da dispersão do gradiente (vanishing gradient) em arquiteturas profundas e comparamos o comportamento assintótico da função sigmoide com unidades retificadoras lineares (ReLU).")
            ]
        },
        # Page 6
        {
            "header": "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
            "title": "6. Regularização e Generalização Estatística",
            "authors": "",
            "sections": [
                ("6.1 Teoria do Aprendizado Estatístico (Vapnik-Chervonenkis)",
                 "A capacidade de generalização de um modelo preditivo não depende unicamente de sua minimização de erro empírico na base de treino, mas da dimensão VC da família de funções hipótese."),
                ("6.2 Penalização de Pesos L1 e L2",
                 "Adicionar termos de penalização na função de custo (Weight Decay) força a solução ótima a buscar hiperplanos com maiores margens de separação, mitigando riscos de sobreajuste (overfitting).")
            ]
        },
        # Page 7 (CRITICAL: Contains the quote for Scenario 2!)
        {
            "header": "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
            "title": "7. Teorema da Convergência e Prova Formal",
            "authors": "",
            "sections": [
                ("7.1 Teorema Fundamental da Convergência do Perceptron",
                 "A convergência do Perceptron é garantida se o conjunto for linearmente separável. Sob a hipótese de existência de um vetor de pesos ótimo w* com margem gamma > 0 e limitante de norma superior R para todos os exemplos x_i, o número total de atualizações de erro antes da estabilização finita é limitado superiormente por (R / gamma)^2."),
                ("7.2 Implicações Práticas da Prova",
                 "Este resultado formal assegura que, em problemas estritamente separáveis, o tempo de treinamento é estritamente finito e independente da ordem de apresentação das amostras no laço principal de épocas.")
            ]
        },
        # Page 8
        {
            "header": "JOURNAL OF NEURAL COMPUTATION - VOL. 12, NO. 3",
            "title": "8. Conclusão e Referências Bibliográficas",
            "authors": "",
            "sections": [
                ("8.1 Considerações Finais",
                 "O Perceptron permanece como alicerce epistemológico da inteligência artificial moderna, unindo simplicidade conceitual com garantias teóricas rigorosas de convergência linear."),
                ("Referências",
                 "[1] Rosenblatt, F. (1958). The Perceptron: A Probabilistic Model for Information Storage and Organization in the Brain. Psychological Review, 65(6), 386-408.\n[2] Minsky, M., & Papert, S. (1969). Perceptrons: An Introduction to Computational Geometry. MIT Press.\n[3] Rumelhart, D. E., Hinton, G. E., & Williams, R. J. (1986). Learning representations by back-propagating errors. Nature, 323, 533-536.")
            ]
        }
    ]

    for page_idx, page in enumerate(pages_data, start=1):
        # Header banner
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(colors.HexColor("#4b5563"))
        c.drawString(54, height - 36, page["header"])
        c.drawRightString(width - 54, height - 36, f"Pág. {page_idx} de {len(pages_data)}")
        c.setStrokeColor(colors.HexColor("#d1d5db"))
        c.setLineWidth(0.5)
        c.line(54, height - 42, width - 54, height - 42)

        y = height - 70

        # Title
        c.setFont("Helvetica-Bold", 16)
        c.setFillColor(colors.HexColor("#111827"))
        c.drawString(54, y, page["title"])
        y -= 24

        # Authors
        if page["authors"]:
            c.setFont("Helvetica-Oblique", 10)
            c.setFillColor(colors.HexColor("#4b5563"))
            c.drawString(54, y, page["authors"])
            y -= 30

        # Sections
        for sec_title, sec_text in page["sections"]:
            c.setFont("Helvetica-Bold", 12)
            c.setFillColor(colors.HexColor("#1f2937"))
            c.drawString(54, y, sec_title)
            y -= 18

            c.setFont("Times-Roman", 10)
            c.setFillColor(colors.HexColor("#374151"))
            
            # Simple text wrap
            words = sec_text.split()
            line = ""
            for word in words:
                if word == "\n":
                    c.drawString(54, y, line)
                    y -= 14
                    line = ""
                    continue
                test_line = line + " " + word if line else word
                if c.stringWidth(test_line, "Times-Roman", 10) < (width - 108):
                    line = test_line
                else:
                    c.drawString(54, y, line)
                    y -= 14
                    line = word
            if line:
                c.drawString(54, y, line)
                y -= 26

        # Footer
        c.setStrokeColor(colors.HexColor("#d1d5db"))
        c.setLineWidth(0.5)
        c.line(54, 45, width - 54, 45)
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.HexColor("#6b7280"))
        c.drawString(54, 32, "Knowledge Dump - Acervo Científico & Documentação Soberana")
        c.drawRightString(width - 54, 32, f"Página {page_idx}")

        c.showPage()

    c.save()
    print(f"PDF gerado com sucesso em: {output_path}")

if __name__ == "__main__":
    generate_academic_paper("data/references/rosenblatt1958_perceptron.pdf")
