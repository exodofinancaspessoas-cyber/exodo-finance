# Guia de Implantação - Êxodo Finance 🚀

Este guia contém as informações necessárias para configurar os ambientes de Desenvolvimento e Produção.

## 1. Variáveis de Ambiente

Para o sistema funcionar, você deve configurar as seguintes variáveis:

### Ambiente de Desenvolvimento (Local)
Configure no arquivo `.env.local`:
```env
VITE_SUPABASE_URL=https://mozbwnrikotnrtrfifqn.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_vJZLBOSWlrXE24AMv3svaA_LtK7URtT
```

### Ambiente de Produção (Vercel)
Adicione estas variáveis no painel da Vercel (**Settings > Environment Variables**):
```env
VITE_SUPABASE_URL=https://teuqygdmogjqpsdrtcow.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_UlkcY1OMqDOlTnovgRGwlg_Jyxrayde
```

---

## 2. Configuração do Banco de Dados (Supabase)

Em **AMBOS** os projetos do Supabase (Dev e Produção), você deve:
1. Ir em **SQL Editor**.
2. Criar uma **New Query**.
3. Colar o conteúdo do arquivo `db/schema.sql`.
4. Clicar em **Run**.

Isso criará as tabelas, políticas de segurança e o gatilho de criação de perfil de usuário.

---

## 3. Deploy na Vercel

1. Garanta que o código esteja no [GitHub](https://github.com/exodofinancaspessoas-cyber/exodo-finance).
2. Na Vercel, clique em **Add New > Project**.
3. Importe o repositório `exodo-finance`.
4. No campo **Environment Variables**, insira as chaves de **Produção** listadas acima.
5. Clique em **Deploy**.

O arquivo `vercel.json` já está configurado para lidar com as rotas do React (SPA).
