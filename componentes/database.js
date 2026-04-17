/* =================================================================================
   2. CONEXÃO COM BANCO DE DADOS (GATEWAY CLOUD)
   ================================================================================= */

// Variável global que será utilizada por todos os outros scripts
let _supabase = null;

try {
    // Verifica se a biblioteca CDN do Supabase foi carregada corretamente no HTML
    if (typeof supabase !== 'undefined') {
        
        // Inicializa o cliente usando as credenciais do config.js
        _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        if (_supabase) {
            console.log("✅ [DATABASE] Supabase conectado com sucesso.");
        }
    } else {
        console.error("❌ [DATABASE] ERRO CRÍTICO: Biblioteca Supabase (CDN) não encontrada.");
        
        // ----------------------------------------------------
        // SUBSTITUIÇÃO DO ALERT (ERRO DE CDN/INTERNET)
        // ----------------------------------------------------
        if (typeof alertaSistema === 'function') {
            alertaSistema("A biblioteca de banco de dados não foi carregada. Verifique sua conexão com a internet.", "Erro de Sistema");
        } else {
            alert("Erro de Sistema: A biblioteca de banco de dados não foi carregada. Verifique sua conexão com a internet.");
        }
    }
} catch (err) { 
    console.error("❌ [DATABASE] ERRO FATAL NA INICIALIZAÇÃO:", err); 
    
    // ----------------------------------------------------
    // SUBSTITUIÇÃO DO ALERT (ERRO DE SERVIDOR/CREDENCIAIS)
    // ----------------------------------------------------
    if (typeof alertaSistema === 'function') {
        alertaSistema("Falha ao conectar com o servidor de dados. O sistema pode não funcionar corretamente.", "Erro Crítico");
    } else {
        alert("Erro Crítico: Falha ao conectar com o servidor de dados.");
    }
}

/* =================================================================================
   CAMADA DE ABSTRAÇÃO (PREPARAÇÃO PARA MIGRAÇÃO FUTURA)
   Estas funções "envelopam" o Supabase. Quando você mudar para outro banco,
   basta alterar o código INTERNO destas funções.
   ================================================================================= */

/**
 * Verifica se a conexão com o banco está ativa
 */
function isDatabaseReady() {
    return _supabase !== null;
}

/**
 * Busca dados de uma tabela (Ex: dbFetch('produtos'))
 */
async function dbFetch(tabela, ordenacao = 'id') {
    if (!isDatabaseReady()) return { data: null, error: 'Banco não conectado' };
    return await _supabase.from(tabela).select('*').order(ordenacao, { ascending: true });
}

/**
 * Insere dados em uma tabela (Ex: dbInsert('vendas', { total: 50 }))
 */
async function dbInsert(tabela, dados) {
    if (!isDatabaseReady()) return { data: null, error: 'Banco não conectado' };
    return await _supabase.from(tabela).insert(dados).select();
}

/**
 * Atualiza dados por ID (Ex: dbUpdate('estoque', 1, { qtd: 10 }))
 */
async function dbUpdate(tabela, id, dados) {
    if (!isDatabaseReady()) return { data: null, error: 'Banco não conectado' };
    return await _supabase.from(tabela).update(dados).eq('id', id).select();
}

/**
 * Remove dados por ID
 */
async function dbDelete(tabela, id) {
    if (!isDatabaseReady()) return { data: null, error: 'Banco não conectado' };
    return await _supabase.from(tabela).delete().eq('id', id);
}

/* DICA DE TESTE: 
   Se você ver a mensagem "Supabase conectado" no console, 
   o caminho para as vendas e comandas está livre! 
*/