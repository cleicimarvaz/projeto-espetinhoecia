// Configurações do Supabase
const SUPABASE_URL = 'https://vtexlttnjzmgknmbwbwl.supabase.co';
const SUPABASE_KEY = 'sb_secret_b1-6wMcVTfECqtHDUKgcDg_4BSflTV4';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Função para buscar produtos do banco
async function carregarProdutos() {
    const { data, error } = await supabase
        .from('produtos')
        .select('*');

    if (error) {
        console.error('Erro ao buscar produtos:', error);
    } else {
        console.log('Produtos carregados:', data);
        // Aqui você faria o loop para exibir no HTML
    }
}

// Lógica do código de 4 dígitos para Comandas
function gerarCodigoComanda() {
    const codigo = Math.floor(1000 + Math.random() * 9000);
    alert("Código da nova comanda: " + codigo);
    return codigo;
}

// Inicialização
carregarProdutos();

// 1. ESTADO DO SISTEMA (SIMULANDO O BANCO)
let comandas = [
    { id: 1, nome: "João Silva", codigo: "4521", itens: [], total: 0 },
    { id: 2, nome: "Maria Oliveira", codigo: "8892", itens: [], total: 0 }
];

let idComandaSelecionada = null; // Guarda qual comanda estamos a editar

// 2. FUNÇÃO PARA SELECIONAR UMA COMANDA
function selecionarComanda(id) {
    idComandaSelecionada = id;
    const comanda = comandas.find(c => c.id === id);
    
    // Alerta visual para o utilizador
    alert(`Modo de Lançamento Ativo: Comanda ${comanda.codigo} (${comanda.nome})`);
    
    // Aqui você navegaria para a tela de produtos
    mostrarTelaProdutos(); 
}

// 3. FUNÇÃO PARA ADICIONAR PRODUTO À COMANDA SELECIONADA
function adicionarProdutoAComanda(produtoId) {
    if (idComandaSelecionada === null) {
        alert("Erro: Selecione uma comanda primeiro!");
        return;
    }

    // Encontra a comanda e o produto
    const comanda = comandas.find(c => c.id === idComandaSelecionada);
    const produto = produtos.find(p => p.id === produtoId);

    // Adiciona o item à lista daquela comanda
    comanda.itens.push({...produto});

    // Recalcula o total da comanda
    comanda.total = comanda.itens.reduce((acc, item) => acc + item.preco, 0);

    console.log(`Item ${produto.nome} lançado para ${comanda.nome}. Novo total: R$ ${comanda.total}`);
    atualizarInterfaceComandas();
}

// 4. FUNÇÃO DE FECHAMENTO (PAGAMENTO)
function fecharComanda() {
    if (idComandaSelecionada === null) return;

    const comanda = comandas.find(c => c.id === idComandaSelecionada);
    
    alert(`Fechando conta de ${comanda.nome}\nTotal a pagar: R$ ${comanda.total.toFixed(2)}`);
    
    // Remove a comanda da lista após o "pagamento"
    comandas = comandas.filter(c => c.id !== idComandaSelecionada);
    idComandaSelecionada = null;
    
    atualizarInterfaceComandas();
}

// 1. Onde guardaremos todas as vendas finalizadas do dia
let historicoVendas = [];

// 2. Simulação de como uma venda entra no histórico
function registrarVendaNoHistorico(itens, total, metodoPagamento) {
    const novaVenda = {
        id: Date.now(),
        data: new Date().toLocaleTimeString(),
        itens: itens, // Array de objetos {nome, preco}
        total: total,
        metodo: metodoPagamento // 'Dinheiro', 'Pix' ou 'Cartão'
    };
    
    historicoVendas.push(novaVenda);
    console.log("Venda salva no histórico local.");
}

// 3. FUNÇÃO DE FECHAMENTO DE CAIXA
function gerarRelatorioFechamento() {
    if (historicoVendas.length === 0) {
        return "Nenhuma venda realizada hoje.";
    }

    // Inicializadores do resumo
    let resumo = {
        totalGeral: 0,
        porMetodo: { Dinheiro: 0, Pix: 0, Cartão: 0 },
        quantidadesPorItem: {}
    };

    // Percorre cada venda do histórico
    historicoVendas.forEach(venda => {
        resumo.totalGeral += venda.total;
        resumo.porMetodo[venda.metodo] += venda.total;

        // Conta a quantidade de cada item individualmente
        venda.itens.forEach(item => {
            if (resumo.quantidadesPorItem[item.nome]) {
                resumo.quantidadesPorItem[item.nome]++;
            } else {
                resumo.quantidadesPorItem[item.nome] = 1;
            }
        });
    });

    return resumo;
}

// 4. Função para exibir o relatório de forma "bonita" no console
function imprimirResumoNoConsole() {
    const dados = gerarRelatorioFechamento();
    
    console.log("--- FECHAMENTO DE CAIXA ---");
    console.log(`TOTAL GERAL: R$ ${dados.totalGeral.toFixed(2)}`);
    console.log("--- POR MÉTODO ---");
    console.table(dados.porMetodo);
    console.log("--- ITENS VENDIDOS ---");
    console.table(dados.quantidadesPorItem);
}