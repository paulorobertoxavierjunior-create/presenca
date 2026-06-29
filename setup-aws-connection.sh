bash:AWS GitHub Connection Setup:setup-aws-connection.sh
#!/bin/bash
# ==============================================================================
# ELAYON DEVOPS PIPELINE - GITHUB TO AWS CONNECTION SETUP
# ==============================================================================
# Este script cria um link de handshake privado entre o GitHub e o AWS CodeBuild.
# Certifique-se de que tem o AWS CLI instalado e autenticado na sua máquina/cloudshell.

CONNECTION_NAME="ElaionGitHubConnection"
REGION="us-east-1" # Altere para a sua região padrão de preferência

echo "================================================================="
echo "🪐 INICIANDO CRIAÇÃO DO AWS CODECONNECTION PARA O GITHUB"
echo "================================================================="

# 1. Cria a conexão pendente de handshake
echo "==> A requisitar criação do recurso no AWS CodeConnections..."
CONNECTION_ARN=$(aws codeconnections create-connection \
    --provider-type GitHub \
    --connection-name "$CONNECTION_NAME" \
    --region "$REGION" \
    --query 'ConnectionArn' \
    --output text)

if [ $? -eq 0 ] && [ ! -z "$CONNECTION_ARN" ]; then
    echo "✓ Conectividade inicial registrada na AWS com sucesso!"
    echo ""
    echo "ARN gerado para o pipeline:"
    echo "👉 $CONNECTION_ARN"
    echo ""
    echo "-----------------------------------------------------------------"
    echo "⚠️ PASSO MANUAL CRÍTICO DE AUTORIZAÇÃO:"
    echo "-----------------------------------------------------------------"
    echo "Por motivos de segurança e integridade de credenciais, deve:"
    echo "1. Aceder ao Console Web da AWS na região: $REGION."
    echo "2. Ir para o menu: Developer Tools > Connections (ou CodePipeline > Settings > Connections)."
    echo "3. Localizar a ligação com o nome: '$CONNECTION_NAME' (estará como PENDING)."
    echo "4. Clicar em 'Update pending connection' e aprovar no GitHub a permissão de leitura para o repositório 'presenca'."
    echo "5. Uma vez aprovado, o status mudará para AVAILABLE e a AWS poderá puxar as alterações para compilar."
    echo "-----------------------------------------------------------------"
else
    echo "❌ Erro ao criar a conexão na AWS. Verifique se o seu AWS CLI está configurado corretamente."
    exit 1
fi