// ==========================================
// MÓDULO DO CLIENTE: RESERVA DE MESAS
// ==========================================

let eventoId = null;
let valorMesa = 0;
let mapaUrl = null; 
let mesasSelecionadas = [];
let mesasConfirmadas = [];
let mesasPendentes = [];  

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    eventoId = urlParams.get('e');

    if (!eventoId) {
        const evNomeEl = document.getElementById('ev-nome');
        if (evNomeEl) evNomeEl.innerText = "Evento não encontrado.";
        if (window.showToast) window.showToast("Acesso inválido: Evento não identificado.", "erro");
        return;
    }

    carregarDadosEvento();

    const formReserva = document.getElementById('form-reserva-cliente');
    if (formReserva) {
        formReserva.addEventListener('submit', salvarReservaFinal);
    }
});

// ==========================================
// 1. CARREGA DADOS BÁSICOS DO EVENTO
// ==========================================
window.carregarDadosEvento = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const idDaUrl = urlParams.get('e');

    if (!idDaUrl) {
        console.error("ID não encontrado na URL");
        return;
    }
    
    eventoId = idDaUrl;

    try {
        // CORREÇÃO: Buscando a coluna com o nome exato do banco -> data_evento
        const { data, error } = await _supabase
            .from('eventos')
            .select('nome, data_evento, quantidade_mesas, valor_mesa, whatsapp_notificacao, mapa_url')
            .eq('id', eventoId)
            .single();

        if (error) throw error;

        // Atualiza o Nome do Evento
        document.getElementById('ev-nome').innerText = data.nome || "Novo Evento";
        
        // Exibe a Data do Evento
        const evDataEl = document.getElementById('ev-data');
        if (data.data_evento && evDataEl) {
            const dataObj = new Date(data.data_evento);
            // Formata a data para o padrão DD/MM/AAAA
            evDataEl.innerText = dataObj.toLocaleDateString('pt-BR');
            evDataEl.style.display = 'block'; 
        } else if (evDataEl) {
            evDataEl.style.display = 'none'; 
        }
        
        // Atualiza o Valor da Mesa
        valorMesa = parseFloat(data.valor_mesa) || 0;
        document.getElementById('ev-valor').innerText = valorMesa.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        // Gerencia a Exibição do Botão do Mapa
        mapaUrl = data.map_url || data.mapa_url || null; 
        const containerMapa = document.getElementById('container-mapa-reserva');
        if (mapaUrl && containerMapa) {
            containerMapa.classList.remove('hidden');
        }
        
        buscarMesasOcupadas(data.quantidade_mesas);

    } catch (err) {
        console.error("Erro ao carregar dados do evento:", err);
        if(window.showToast) window.showToast("Erro ao carregar evento.", "erro");
    }
};

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
    const baseClasses = "p-3 font-black text-xs rounded-xl transition-all border text-center active:scale-95";
    const classeSelecionada = "bg-emerald-800 text-white border-emerald-900";
    const classeLivre = "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-100 cursor-pointer";
    
    const index = mesasSelecionadas.indexOf(numeroMesa);
    
    if (index > -1) {
        mesasSelecionadas.splice(index, 1);
        elementoBotao.className = baseClasses + " " + classeLivre;
    } else {
        mesasSelecionadas.push(numeroMesa);
        elementoBotao.className = baseClasses + " " + classeSelecionada;
    }

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
    if (btn) {
        btn.disabled = true;
        btn.innerText = "ENVIANDO RESERVA...";
    }

    try {
        const nome = document.getElementById('cli-nome').value.trim();
        const telefone = document.getElementById('cli-tel').value.trim();
        const fileInput = document.getElementById('cli-comprovante');
        
        let comprovanteUrl = null;

        if (fileInput && fileInput.files.length > 0) {
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
        
        window.enviarConfirmacaoWhatsApp(nome, mesasSelecionadas.join(', '));
        
        const formCliente = document.getElementById('form-reserva-cliente');
        if (formCliente) formCliente.reset();
        
        mesasSelecionadas = [];
        const elTotal = document.getElementById('valor-total');
        if (elTotal) elTotal.innerText = "0,00";
        
        carregarDadosEvento();

    } catch (error) {
        console.error("Erro ao salvar reserva:", error);
        if (window.showToast) window.showToast("Falha ao salvar. Verifique se a mesa já foi ocupada.", "erro");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "FINALIZAR RESERVA";
        }
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

window.abrirModalMapa = function(urlBase64) {
    const urlDestino = urlBase64 || mapaUrl;
    
    if (!urlDestino) {
        if (typeof showToast === 'function') showToast("Este evento não possui um mapa anexado.", "info");
        return;
    }
    
    const imgModal = document.getElementById('img-mapa-modal');
    if (imgModal) imgModal.src = urlDestino;
    
    const modal = document.getElementById('modal-mapa-evento');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.fecharModalMapa = function() {
    const modal = document.getElementById('modal-mapa-evento');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    
    setTimeout(() => {
        const img = document.getElementById('img-mapa-modal');
        if (img) img.src = '';
    }, 300);
};