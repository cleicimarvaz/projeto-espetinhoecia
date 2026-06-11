/* =================================================================================
   2. CONEXÃO COM BANCO DE DADOS (GATEWAY CLOUD)
   ================================================================================= */

// Variável global que será utilizada por todos os outros scripts
window._supabase = null;

// Função auxiliar blindada para substituir o alert nativo em falhas de carregamento
function notificarErroBanco(mensagem) {
    console.error("❌ [DATABASE ERRO]:", mensagem);
    
    if (typeof window.showToast === 'function') {
        window.showToast(mensagem, "erro");
    } else if (typeof window.alertaSistema === 'function') {
        window.alertaSistema(mensagem, "Erro Crítico");
    } else {
        // Fallback visual extremo: Cria um banner elegante no topo da tela caso o Toast não exista ainda
        window.addEventListener('DOMContentLoaded', () => {
            const banner = document.createElement('div');
            banner.className = "fixed top-0 left-0 w-full bg-red-600 text-white text-center p-3 font-bold z-[9999] shadow-lg text-xs uppercase tracking-widest";
            banner.innerHTML = `⚠️ Falha de Conexão: ${mensagem}`;
            document.body.prepend(banner);
            // Remove o banner automaticamente após 5 segundos
            setTimeout(() => banner.remove(), 5000);
        });
    }
}

try {
    // Verifica se a biblioteca CDN do Supabase foi carregada corretamente no HTML
    if (typeof supabase !== 'undefined') {
        
        // Inicializa o cliente usando as credenciais do config.js (SUPABASE_URL e SUPABASE_KEY)
        window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        if (window._supabase) {
            console.log("✅ [DATABASE] Supabase conectado com sucesso.");
        }
    } else {
        throw new Error("Biblioteca Supabase (CDN) não encontrada.");
    }
} catch (err) { 
    console.error("❌ [DATABASE] ERRO FATAL NA INICIALIZAÇÃO:", err); 
    notificarErroBanco("A biblioteca de banco de dados não foi carregada. Verifique sua conexão com a internet.");
}

/* =================================================================================
   CAMADA DE ABSTRAÇÃO (PREPARAÇÃO PARA MIGRAÇÃO FUTURA)
   Estas funções "envelopam" o Supabase. Quando você mudar para outro banco,
   basta alterar o código INTERNO destas funções.
   ================================================================================= */

/**
 * Verifica se a conexão com o banco está ativa
 */
window.isDatabaseReady = function() {
    return window._supabase !== null;
}

/**
 * Busca dados de uma tabela (Ex: dbFetch('produtos'))
 */
window.dbFetch = async function(tabela, ordenacao = 'id') {
    if (!window.isDatabaseReady()) return { data: null, error: 'Banco não conectado' };
    return await window._supabase.from(tabela).select('*').order(ordenacao, { ascending: true });
}

/**
 * Insere dados em uma tabela (Ex: dbInsert('vendas', { total: 50 }))
 */
window.dbInsert = async function(tabela, dados) {
    if (!window.isDatabaseReady()) return { data: null, error: 'Banco não conectado' };
    return await window._supabase.from(tabela).insert(dados).select();
}

/**
 * Atualiza dados por ID (Ex: dbUpdate('estoque', 1, { qtd: 10 }))
 */
window.dbUpdate = async function(tabela, id, dados) {
    if (!window.isDatabaseReady()) return { data: null, error: 'Banco não conectado' };
    return await window._supabase.from(tabela).update(dados).eq('id', id).select();
}

/**
 * Remove dados por ID
 */
window.dbDelete = async function(tabela, id) {
    if (!window.isDatabaseReady()) return { data: null, error: 'Banco não conectado' };
    return await window._supabase.from(tabela).delete().eq('id', id);
}

/* DICA DE TESTE: 
   Se você ver a mensagem "Supabase conectado" no console, 
   o caminho para as vendas e comandas está livre! 
*/