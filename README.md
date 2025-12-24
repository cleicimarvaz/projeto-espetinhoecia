🍢 Espetinho & Cia - Sistema de Gestão Web (PWA)
O Espetinho & Cia é uma aplicação web completa desenvolvida para a gestão ágil de pequenos negócios de alimentação, como espetinhos e feiras livres. O sistema foi projetado para funcionar como um PWA (Progressive Web App), permitindo sua instalação em dispositivos móveis e operação otimizada para telas touch.

🚀 Funcionalidades Principal
👤 Controle de Acesso
Sistema de login com níveis de permissão (Administrador e Vendedor).

Proteção de rotas para áreas administrativas.

🛒 Operação de Vendas
Venda Direta: Carrinho de compras intuitivo para vendas rápidas de fichas.

Comandas: Abertura e gerenciamento de consumo por cliente ou mesa.

Divisão de Conta: Lógica inteligente para pagamento parcial de itens e divisão por pessoas.

Lançamentos: Adição dinâmica de produtos a comandas abertas via interface mobile.

🛠️ Gestão e Retaguarda
Catálogo de Produtos: Cadastro, edição e exclusão de itens com controle de estoque.

Fechamento de Caixa: Relatório consolidado com totais por método de pagamento (Dinheiro, Pix, Cartão) e ranking de itens mais vendidos.

Estorno: Sistema de cancelamento de vendas com atualização automática do relatório financeiro.

Configurações: Personalização do nome do evento para impressão de tickets.

📱 Inovação Digital
Gerador de QR Code: Criação automática de códigos QR para cada comanda, permitindo o acesso rápido ao lançamento de itens via câmera.

🛠️ Tecnologias Utilizadas
O projeto foi construído utilizando as melhores práticas de desenvolvimento Front-End modernas:

HTML5 & CSS3: Estrutura semântica e estilização customizada.

Tailwind CSS: Framework utilitário para design responsivo e moderno.

JavaScript (Vanilla): Lógica de negócio centralizada e manipulação dinâmica do DOM sem dependências pesadas.

LocalStorage API: Persistência de dados local, garantindo que as informações não sejam perdidas ao fechar o navegador.

PWA (Progressive Web App): Utilização de Service Workers e Web Manifest para instalação e suporte offline.

QRCode.js: Biblioteca para geração dinâmica de códigos QR.

📂 Estrutura do Projeto
Para garantir a escalabilidade e facilidade de manutenção, o projeto adota a separação de responsabilidades:

Bash

├── index.html          # Redirecionamento inicial
├── login.html          # Tela de autenticação
├── home.html           # Menu principal
├── style.css           # Estilização centralizada e variáveis de tema
├── scripts.js          # O "Cérebro" do sistema (Lógica unificada)
├── sw.js               # Service Worker para suporte PWA
├── manifest.json       # Configurações de instalação no celular
└── img/                # Assets e logotipia
📲 Como Instalar (PWA)
Como o sistema é um Progressive Web App, ele pode ser instalado em qualquer smartphone:

Acesse a URL do projeto através de um navegador (Chrome ou Safari).

Android: Clique no banner "Adicionar à tela inicial".

iOS (iPhone): Toque no botão de compartilhamento e selecione "Adicionar à Tela de Início".

O ícone do Espetinho & Cia aparecerá no seu menu de aplicativos, funcionando sem as barras do navegador.

👨‍💻 Desenvolvedor
Projeto desenvolvido por Cleicimar Vaz.
