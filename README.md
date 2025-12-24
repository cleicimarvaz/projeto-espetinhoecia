🍢 Espetinho & Cia - Sistema de Gestão Web (PWA) & PDV Cloud
O Espetinho & Cia é uma aplicação web de alta performance desenvolvida para a gestão ágil de negócios de alimentação. Evoluído de um sistema local para uma plataforma Cloud Real-Time, o projeto integra um PDV robusto com controle de mesas e segurança financeira avançada.

🚀 Funcionalidades Principais
👤 Controle de Acesso e Gestão
Níveis de Permissão: Diferenciação entre Administrador e Vendedor.

Gestão de Inventário: Catálogo de produtos com Switch de Ativação instantânea no PDV.

Dashboard em Tempo Real: Indicadores de faturamento diário e contagem de mesas ativas na tela inicial.

🛒 Operação de Vendas e Mesas
Venda Direta e Comandas: Fluxo otimizado para vendas rápidas no balcão ou monitoramento de consumo por mesa.

Lógica de Divisão Inteligente: Módulo para pagamento parcial por itens selecionados ou abatimento de valor fixo.

Remoção Segura: Botão de exclusão de itens fixado no canto inferior direito para evitar erros operacionais.

🛡️ Segurança Financeira (Trava de Paridade)
Bloqueio Universal: O sistema impede o encerramento de qualquer conta se o valor recebido for diferente (maior ou menor) do valor consumido.

Feedback Visual: Visor de troco dinâmico que altera a cor (Vermelho/Verde) para auxiliar o operador na conferência.

🖨️ Impressão Térmica Profissional (58mm)
Tickets Individuais por Unidade: Se uma venda contém 3 itens, o sistema gera 3 tickets individuais de consumo.

Impressão Sequencial: Emissão em fita contínua com separadores tracejados, otimizada para impressoras térmicas de 58mm.

Estética de Festival: Layout com bordas laterais coloridas e caixa de destaque para facilitar a leitura na produção.

🛠️ Tecnologias Utilizadas
Frontend: HTML5 semântico e Tailwind CSS para design responsivo e moderno.

Backend & Database: Supabase (PostgreSQL) para persistência em nuvem e sincronização em tempo real.

Lógica de Negócio: Vanilla JavaScript estruturado em 48 funções modulares.

PWA (Progressive Web App): Suporte a Service Workers e Web Manifest para instalação em smartphones.

📂 Estrutura do Projeto
Bash

├── index.html          # Portal de autenticação (Login)
├── home.html           # Dashboard e indicadores principais
├── venda.html          # Interface de PDV e Venda Direta
├── comandas.html       # Mapa de mesas e gestão de contas abertas
├── divisao.html        # Módulo de pagamentos parciais e abatimentos
├── fechamento.html     # Relatórios financeiros e histórico de vendas
├── style.css           # Estilização centralizada e regras de impressão
├── scripts.js          # O "Cérebro" do sistema (48 funções unificadas)
└── sw.js               # Service Worker para suporte PWA
📲 Instalação e Uso
Acesso Web: Acesse a URL do projeto via Chrome ou Safari.

Instalação PWA: Selecione "Adicionar à tela inicial" para utilizar como um aplicativo nativo.

Configuração de Banco: Importe as tabelas e povoamento via SQL queries fornecidas no editor do Supabase.

Impressão: Certifique-se de configurar a impressora térmica para papel de 58mm sem margens de cabeçalho do navegador.

Desenvolvedor: Cleicimar Vaz Sistema projetado para máxima eficiência e precisão financeira.