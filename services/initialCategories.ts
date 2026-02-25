
import { Category } from '../types';

export const INITIAL_CATEGORIES_DATA = [
    {
        name: 'MORADIA', color: '#3b82f6', sub: [
            'Aluguel/Financiamento', 'Condomínio', 'IPTU', 'Energia elétrica', 'Água e esgoto',
            'Gás (botijão/encanado)', 'Internet', 'Telefone fixo', 'TV por assinatura',
            'Manutenção e reparos', 'Reforma e melhorias', 'Móveis e decoração', 'Seguro residencial'
        ]
    },
    {
        name: 'TRANSPORTE', color: '#ef4444', sub: [
            'Prestação do veículo', 'Combustível', 'Estacionamento', 'IPVA', 'Licenciamento',
            'Seguro do veículo', 'Manutenção do veículo', 'Lavagem', 'Pedágios',
            'Transporte público (ônibus, metrô)', 'Táxi/Uber/99', 'Multas de trânsito'
        ]
    },
    {
        name: 'ALIMENTAÇÃO', color: '#10b981', sub: [
            'Supermercado', 'Feira/hortifruti', 'Açougue/peixaria', 'Padaria',
            'Restaurantes', 'Delivery', 'Lanchonete/cafeteria', 'Água/bebidas'
        ]
    },
    {
        name: 'SAÚDE', color: '#f43f5e', sub: [
            'Plano de saúde', 'Consultas médicas', 'Exames', 'Medicamentos',
            'Dentista/ortodontia', 'Terapia/psicólogo', 'Fisioterapia', 'Óculos/lentes',
            'Cirurgias', 'Hospital/pronto-socorro', 'Suplementos alimentares'
        ]
    },
    {
        name: 'EDUCAÇÃO', color: '#2dd4bf', sub: [
            'Mensalidade escolar/faculdade', 'Material escolar', 'Livros didáticos',
            'Cursos e workshops', 'Cursos online', 'Material de estudo',
            'Uniforme escolar', 'Transporte escolar', 'Atividades extracurriculares'
        ]
    },
    {
        name: 'LAZER E ENTRETENIMENTO', color: '#f59e0b', sub: [
            'Streaming (Netflix, Prime, Disney+, etc.)', 'Spotify/Apple Music', 'Cinema',
            'Teatro/shows', 'Eventos e festas', 'Viagens e turismo', 'Hobbies',
            'Jogos e games', 'Clubes e associações', 'Esportes e atividades'
        ]
    },
    {
        name: 'CUIDADOS PESSOAIS', color: '#ec4899', sub: [
            'Cabelo (corte, coloração, tratamentos)', 'Manicure/pedicure',
            'Estética (depilação, limpeza de pele)', 'Academia', 'Personal trainer',
            'Produtos de higiene pessoal', 'Cosméticos e maquiagem', 'Perfumes', 'Spa/massagem'
        ]
    },
    {
        name: 'VESTUÁRIO', color: '#6366f1', sub: [
            'Roupas', 'Calçados', 'Acessórios', 'Roupas íntimas',
            'Roupas de esporte', 'Uniformes profissionais', 'Lavanderia/tinturaria', 'Consertos e ajustes'
        ]
    },
    {
        name: 'COMUNICAÇÃO', color: '#06b6d4', sub: [
            'Celular (conta)', 'Recarga de celular', 'Aparelho celular (prestação)', 'Correios/sedex'
        ]
    },
    {
        name: 'FINANCEIRO', color: '#475569', sub: [
            'Tarifas bancárias', 'Anuidade de cartão', 'DOC/TED', 'IOF', 'Juros e multas',
            'Empréstimos', 'Cheque especial', 'Crédito consignado', 'Parcelamentos diversos'
        ]
    },
    {
        name: 'SEGUROS E PROTEÇÃO', color: '#1e293b', sub: [
            'Seguro de vida', 'Seguro residencial', 'Seguro do veículo', 'Seguro saúde', 'Previdência privada'
        ]
    },
    {
        name: 'IMPOSTOS E TAXAS', color: '#94a3b8', sub: [
            'IPTU', 'IPVA', 'Imposto de Renda', 'Taxas de renovação (CNH, documentos)',
            'Taxas de cartório', 'Contribuição sindical'
        ]
    },
    {
        name: 'FAMÍLIA E DEPENDENTES', color: '#fb923c', sub: [
            'Pensão alimentícia', 'Mesada dos filhos', 'Creche/babá', 'Fraldas e produtos infantis',
            'Roupas infantis', 'Brinquedos', 'Festas infantis'
        ]
    },
    {
        name: 'PETS', color: '#a855f7', sub: [
            'Ração', 'Veterinário', 'Vacinas', 'Banho e tosa', 'Medicamentos pet',
            'Acessórios', 'Hotel/creche para pets'
        ]
    },
    {
        name: 'INVESTIMENTOS', color: '#15803d', sub: [
            'Poupança', 'Tesouro Direto', 'Ações', 'Fundos de investimento',
            'CDB/LCI/LCA', 'Previdência privada', 'Criptomoedas', 'Reserva de emergência'
        ]
    },
    {
        name: 'DOAÇÕES E CONTRIBUIÇÕES', color: '#eab308', sub: [
            'Doações religiosas (dízimo/ofertas)', 'Doações para caridade',
            'Contribuições sociais', 'Presentes (aniversários, casamentos, etc.)', 'Vaquinhas'
        ]
    },
    {
        name: 'PROFISSIONAL', color: '#2dd4bf', sub: [
            'Cursos de qualificação', 'Material de trabalho', 'Uniforme profissional',
            'Almoço de trabalho', 'Deslocamento trabalho',
            'Contribuição profissional (CRM, OAB, CREA, etc.)', 'Coworking'
        ]
    }
];
