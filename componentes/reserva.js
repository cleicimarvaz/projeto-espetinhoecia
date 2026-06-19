// ==========================================
// MÓDULO DO CLIENTE: RESERVA DE MESAS
// ==========================================

let eventoId = null;
let valorMesa = 0;
let mesasSelecionadas = [];
let mesasConfirmadas = []; // Cor Vermelha (Já pago)
let mesasPendentes = [];   // Cor Laranja (Aguardando aprovação)

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    eventoId = urlParams.get('e');

    if (!eventoId) {
        document.getElementById('ev-nome').innerText = "Evento não encontrado.";
        if (window.showToast) window.showToast("Acesso inválido: Evento não identificado.", "erro");
        return;
    }

    carregarDadosEvento();

    document.getElementById('form-reserva-cliente').addEventListener('submit', salvarReservaFinal);
});

// ==========================================
// 1. CARREGA DADOS BÁSICOS DO EVENTO
// ==========================================
// Exemplo de como deve ser a chamada dentro do seu componente
async function carregarDadosEvento(eventoId) {
    try {
        const { data, error } = await _supabase
            .from('eventos')
            .select('quantidade_mesas, whatsapp_notificacao, patrocinadores')
            .eq('id', eventoId)
            .single();

        if (error) throw error;
        
        console.log("Dados carregados:", data);
        // Aqui você preenche os campos do modal com 'data.patrocinadores'
        document.getElementById('lista-patrocinadores-input').value = data.patrocinadores || '';
        
    } catch (err) {
        console.error("Erro ao carregar dados do evento:", err);
    }
}

// ==========================================
// 2. VERIFICA QUAIS MESAS JÁ ESTÃO OCUPADAS
// ==========================================
async function buscarMesasOcupadas(totalMesas) {
    try {
        const { data: reservas, error } = await _supabase
            .from('reservas_evento')
            .select('mesas, status')
            .eq('evento_id', eventoId);

        if (error) throw error;

        mesasConfirmadas = [];
        mesasPendentes = [];

        if (reservas) {
            reservas.forEach(res => {
                if (Array.isArray(res.mesas)) {
                    if (res.status === 'confirmada') {
                        mesasConfirmadas.push(...res.mesas);
                    } else if (res.status === 'pendente') {
                        mesasPendentes.push(...res.mesas);
                    }
                }
            });
        }
        gerarGradeMesas(totalMesas);
    } catch (error) {
        console.error("Erro ao buscar ocupação:", error);
    }
}

// ==========================================
// 3. DESENHA A GRADE NA TELA COM CORES
// ==========================================
function gerarGradeMesas(totalMesas) {
    const grade = document.getElementById('grade-mesas');
    if (!grade) return;
    grade.innerHTML = "";
    
    // Classes que definem o visual (padrão)
    const baseClasses = "p-3 font-black text-xs rounded-xl transition-all border text-center active:scale-95";
    const classeSelecionada = "bg-emerald-800 text-white border-emerald-900";
    const classeLivre = "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-100 cursor-pointer";
    
    for (let i = 1; i <= totalMesas; i++) {
        const estaConfirmada = mesasConfirmadas.includes(i);
        const estaPendente = mesasPendentes.includes(i);
        const estaSelecionada = mesasSelecionadas.includes(i);
        
        const btn = document.createElement('button');
        btn.type = "button";
        btn.innerText = String(i).padStart(2, '0');
        
        if (estaConfirmada) {
            btn.className = baseClasses + " bg-red-100 text-red-500 border-red-200 cursor-not-allowed opacity-70";
            btn.disabled = true;
        } else if (estaPendente) {
            btn.className = baseClasses + " bg-amber-100 text-amber-600 border-amber-200 cursor-not-allowed opacity-80 animate-pulse";
            btn.disabled = true;
        } else if (estaSelecionada) {
            btn.className = baseClasses + " " + classeSelecionada;
            btn.onclick = () => alternarSelecaoMesa(i, btn);
        } else {
            btn.className = baseClasses + " " + classeLivre;
            btn.onclick = () => alternarSelecaoMesa(i, btn);
        }
        
        grade.appendChild(btn);
    }
}

// ==========================================
// 4. SELEÇÃO E CÁLCULO
// ==========================================
function alternarSelecaoMesa(numeroMesa, elementoBotao) {
    // Classes idênticas às da função gerarGradeMesas
    const baseClasses = "p-3 font-black text-xs rounded-xl transition-all border text-center active:scale-95";
    const classeSelecionada = "bg-emerald-800 text-white border-emerald-900";
    const classeLivre = "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-100 cursor-pointer";
    
    const index = mesasSelecionadas.indexOf(numeroMesa);
    
    if (index > -1) {
        // DESMARCANDO: Volta para o estado Livre (Branco)
        mesasSelecionadas.splice(index, 1);
        elementoBotao.className = baseClasses + " " + classeLivre;
    } else {
        // SELECIONANDO: Fica Verde Escuro (Sólido)
        mesasSelecionadas.push(numeroMesa);
        elementoBotao.className = baseClasses + " " + classeSelecionada;
    }

    // Atualiza valor
    const total = mesasSelecionadas.length * valorMesa;
    const elTotal = document.getElementById('valor-total');
    if (elTotal) {
        elTotal.innerText = total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    }
}

// ==========================================
// 5. ENVIO DOS DADOS PARA O SUPABASE
// ==========================================
async function salvarReservaFinal(e) {
    e.preventDefault();

    if (mesasSelecionadas.length === 0) {
        if (window.showToast) window.showToast("Selecione pelo menos uma mesa livre.", "aviso");
        return;
    }

    const btn = document.getElementById('btn-enviar');
    btn.disabled = true;
    btn.innerText = "ENVIANDO RESERVA...";

    try {
        const nome = document.getElementById('cli-nome').value.trim();
        const telefone = document.getElementById('cli-tel').value.trim();
        const fileInput = document.getElementById('cli-comprovante');
        
        let comprovanteUrl = null;

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `pix_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const path = `comprovantes/${fileName}`;

            const { error: uploadError } = await _supabase.storage.from('eventos').upload(path, file);
            if (uploadError) throw uploadError;
            
            const { data } = _supabase.storage.from('eventos').getPublicUrl(path);
            comprovanteUrl = data.publicUrl;
        }

        const novaReserva = {
            evento_id: eventoId,
            mesas: mesasSelecionadas, 
            cliente_nome: nome,
            cliente_telefone: telefone,
            comprovante_url: comprovanteUrl,
            status: 'pendente'
        };

        const { error } = await _supabase.from('reservas_evento').insert([novaReserva]);
        if (error) throw error;

        if (window.showToast) window.showToast("Reserva enviada com sucesso!", "sucesso");
        
        // Dispara mensagem para o ADMINISTRADOR
        window.enviarConfirmacaoWhatsApp(nome, mesasSelecionadas.join(', '));
        
        document.getElementById('form-reserva-cliente').reset();
        mesasSelecionadas = [];
        document.getElementById('valor-total').innerText = "0,00";
        carregarDadosEvento();

    } catch (error) {
        console.error("Erro ao salvar reserva:", error);
        if (window.showToast) window.showToast("Falha ao salvar. Verifique se a mesa já foi ocupada.", "erro");
    } finally {
        btn.disabled = false;
        btn.innerText = "FINALIZAR RESERVA";
    }
}

// ==========================================
// 6. UTILITÁRIOS (WHATSAPP, MÁSCARA, MODAIS)
// ==========================================
window.enviarConfirmacaoWhatsApp = function(nome, mesas) {
    const numeroEstabelecimento = "3398620041"; 
    const mensagem = `Olá! Me chamo *${nome}*. Acabei de realizar uma solicitação de reserva pelo sistema para as mesas: *${mesas}*.\n\nAguardo a confirmação!`;
    const linkWhatsApp = `https://wa.me/55${numeroEstabelecimento}?text=${encodeURIComponent(mensagem)}`;
    window.open(linkWhatsApp, '_blank');
};

window.aplicarMascaraTelefone = function(input) {
    let valor = input.value.replace(/\D/g, '');
    valor = valor.replace(/^(\d{2})(\d)/g, '($1) $2');
    valor = valor.replace(/(\d{5})(\d)/, '$1-$2');
    input.value = valor.substring(0, 15);
};

window.abrirModalMapa = function() {
    document.getElementById('modal-mapa-evento').classList.remove('hidden');
};

window.fecharModalMapa = function() {
    document.getElementById('modal-mapa-evento').classList.add('hidden');
};
