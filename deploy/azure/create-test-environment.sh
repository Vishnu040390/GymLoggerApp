#!/usr/bin/env bash
# Creates the GymLogger TEST environment in Azure (spec §42: QA / Test).
#
#   Web app:  Azure App Service, Linux, Free (F1) plan by default  → https://<APP_NAME>.azurewebsites.net
#   Database: Azure SQL Database, serverless, free offer (pauses when the free monthly limit is used)
#
# Run it in Azure Cloud Shell (Bash): https://shell.azure.com
#   curl -fsSL https://raw.githubusercontent.com/Vishnu040390/GymLoggerApp/claude/jolly-gates-t1qagy/deploy/azure/create-test-environment.sh -o create-test-env.sh
#   APP_NAME=gymlogger-test-<something-unique> bash create-test-env.sh
#
# Optional settings (environment variables):
#   LOCATION        Azure region, default eastus (use the one nearest your testers, e.g. centralindia, westeurope)
#   PLAN_SKU        App Service plan size, default F1 (free). B1 is the smallest paid size (about USD 13/month)
#                   for subscriptions with no free (F1) quota in the region.
#   SQL_LOCATION    region for the database, default LOCATION (for regions not accepting new SQL servers)
#   RESOURCE_GROUP  default <APP_NAME>-rg
#   ADMIN_EMAIL     admin sign-in for the test site, default admin@gymlogger.test
#   DEMO_TIME_ZONE  IANA zone for demo workout times, default UTC (e.g. Asia/Kolkata, Europe/London)
#   SQL_FREE        true (default) uses the free Azure SQL offer; false creates a Basic database (about USD 5/month)
#
# Re-running is safe: existing resources are reused. Secrets are generated here and
# stored only in the App Service configuration; the admin password is printed once.
set -euo pipefail

APP_NAME="${APP_NAME:?Set APP_NAME, for example: APP_NAME=gymlogger-test-4821 bash create-test-env.sh}"
LOCATION="${LOCATION:-eastus}"
RESOURCE_GROUP="${RESOURCE_GROUP:-${APP_NAME}-rg}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@gymlogger.test}"
DEMO_TIME_ZONE="${DEMO_TIME_ZONE:-UTC}"
SQL_FREE="${SQL_FREE:-true}"
PLAN_SKU="${PLAN_SKU:-F1}"
SQL_LOCATION="${SQL_LOCATION:-$LOCATION}"
PLAN="${APP_NAME}-plan"
SQL_SERVER="${APP_NAME}-sql"
SQL_DB="gymlogger"
SQL_ADMIN="gymadmin"

step() { printf '\n==> %s\n' "$*"; }

# Runs an Azure CLI create command. If it fails, prints Azure's error and, when the error
# matches the pattern, the hint (what to change before re-running), then stops.
create_or_explain() {
  local pattern="$1" hint="$2" output
  shift 2
  if ! output="$("$@" 2>&1)"; then
    printf '%s\n' "$output" >&2
    if grep -Eiq "$pattern" <<<"$output"; then printf '\n%s\n' "$hint" >&2; fi
    exit 1
  fi
}

step "Checking that App Service supports .NET 10 on Linux"
if ! az webapp list-runtimes --os-type linux -o tsv | grep -Eiq 'DOTNETCORE[:|]10\.0'; then
  echo "Warning: DOTNETCORE:10.0 is not listed by 'az webapp list-runtimes --os-type linux'. Creating the web app may fail; update the Azure CLI (az upgrade) if it does." >&2
fi

step "Resource group $RESOURCE_GROUP"
# An existing group is reused whatever its region: resources inside it can be in any region.
az group show --name "$RESOURCE_GROUP" --output none 2>/dev/null ||
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

step "App Service plan $PLAN (Linux, $PLAN_SKU, $LOCATION)"
if ! az appservice plan show --name "$PLAN" --resource-group "$RESOURCE_GROUP" --output none 2>/dev/null; then
  create_or_explain 'quota' "\
Your subscription has no App Service $PLAN_SKU quota in $LOCATION (new and trial subscriptions often
start at 0 in busy regions). Pick one option and run the script again (re-running is safe):

  1. Another region (free):
       APP_NAME=$APP_NAME LOCATION=centralindia bash create-test-env.sh
     Other regions to try: southindia, westeurope, uksouth, westus2, southeastasia.

  2. Ask for free quota in this region: Azure portal → search \"Quotas\" → App Service →
     region $LOCATION → $PLAN_SKU → request a new limit of 1. If App Service is not listed there, use
     Help + support → Create a support request → \"Service and subscription limits (quotas)\".

  3. The smallest paid plan (about USD 13/month; free-trial credit covers it):
       APP_NAME=$APP_NAME LOCATION=$LOCATION PLAN_SKU=B1 bash create-test-env.sh" \
    az appservice plan create --name "$PLAN" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" \
      --is-linux --sku "$PLAN_SKU" --output none
fi

step "Web app $APP_NAME"
az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --output none 2>/dev/null ||
  az webapp create --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --plan "$PLAN" --runtime "DOTNETCORE:10.0" --output none
az webapp update --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --https-only true --output none
az webapp config set --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --startup-file "dotnet GYM.Web.dll" --ftps-state Disabled --output none

step "Azure SQL server $SQL_SERVER and database $SQL_DB ($SQL_LOCATION)"
SQL_PASSWORD="$(openssl rand -hex 16)Aa1!"
if az sql server show --name "$SQL_SERVER" --resource-group "$RESOURCE_GROUP" --output none 2>/dev/null; then
  az sql server update --name "$SQL_SERVER" --resource-group "$RESOURCE_GROUP" --admin-password "$SQL_PASSWORD" --output none
else
  create_or_explain 'not accepting|RegionDoesNotAllowProvisioning|ProvisioningDisabled' "\
Azure SQL is not taking new servers in $SQL_LOCATION for this subscription. The web app is already
created; put the database in another region and run the script again (re-running is safe):
  APP_NAME=$APP_NAME LOCATION=$LOCATION PLAN_SKU=$PLAN_SKU SQL_LOCATION=centralindia bash create-test-env.sh" \
    az sql server create --name "$SQL_SERVER" --resource-group "$RESOURCE_GROUP" --location "$SQL_LOCATION" \
      --admin-user "$SQL_ADMIN" --admin-password "$SQL_PASSWORD" --minimal-tls-version 1.2 --output none
fi
# 0.0.0.0 is Azure's special rule for "allow Azure services" (the web app); it does not open the database to the internet.
az sql server firewall-rule create --server "$SQL_SERVER" --resource-group "$RESOURCE_GROUP" \
  --name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 --output none
if ! az sql db show --name "$SQL_DB" --server "$SQL_SERVER" --resource-group "$RESOURCE_GROUP" --output none 2>/dev/null; then
  if [ "$SQL_FREE" = "true" ]; then
    az sql db create --name "$SQL_DB" --server "$SQL_SERVER" --resource-group "$RESOURCE_GROUP" \
      --edition GeneralPurpose --compute-model Serverless --family Gen5 --capacity 2 \
      --use-free-limit true --free-limit-exhaustion-behavior AutoPause --output none
  else
    az sql db create --name "$SQL_DB" --server "$SQL_SERVER" --resource-group "$RESOURCE_GROUP" --service-objective Basic --output none
  fi
fi
CONNECTION="Server=tcp:${SQL_SERVER}.database.windows.net,1433;Database=${SQL_DB};User ID=${SQL_ADMIN};Password=${SQL_PASSWORD};Encrypt=True;TrustServerCertificate=False;Connection Timeout=60;"

step "App configuration (Test environment)"
# Keep the admin password from an earlier run: the account is created only once.
ADMIN_PASSWORD="$(az webapp config appsettings list --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --query "[?name=='Seed__AdminPassword'].value | [0]" -o tsv 2>/dev/null || true)"
if [ -z "$ADMIN_PASSWORD" ] || [ "$ADMIN_PASSWORD" = "None" ]; then
  ADMIN_PASSWORD="Gym-$(openssl rand -hex 6)-A1"
fi
az webapp config connection-string set --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --connection-string-type SQLAzure --settings Gym="$CONNECTION" --output none
az webapp config appsettings set --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --output none --settings \
  ASPNETCORE_ENVIRONMENT=Test \
  ASPNETCORE_FORWARDEDHEADERS_ENABLED=true \
  Seed__AdminEmail="$ADMIN_EMAIL" \
  Seed__AdminPassword="$ADMIN_PASSWORD" \
  Seed__DemoTimeZone="$DEMO_TIME_ZONE"

step "Allowing deployments from GitHub Actions (publish profile)"
az resource update --resource-group "$RESOURCE_GROUP" --namespace Microsoft.Web --resource-type basicPublishingCredentialsPolicies \
  --parent "sites/$APP_NAME" --name scm --set properties.allow=true --output none
az webapp deployment list-publishing-profiles --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --xml > "${APP_NAME}.PublishSettings"

cat <<DONE

Test environment created: https://${APP_NAME}.azurewebsites.net   (it shows an Azure placeholder until the first deploy)

Next, in GitHub (https://github.com/Vishnu040390/GymLoggerApp/settings):
  1. Secrets and variables → Actions → Variables → New repository variable
       Name:  AZURE_WEBAPP_NAME     Value: ${APP_NAME}
  2. Secrets and variables → Actions → Secrets → New repository secret
       Name:  AZURE_WEBAPP_PUBLISH_PROFILE
       Value: the whole contents of ${APP_NAME}.PublishSettings (run: cat ${APP_NAME}.PublishSettings)
  3. Actions → "Deploy to test" → Run workflow (later pushes deploy automatically)

Test-site admin sign-in (save it now; it is not shown again):
  Email:    ${ADMIN_EMAIL}
  Password: ${ADMIN_PASSWORD}

Delete ${APP_NAME}.PublishSettings after adding the secret. To remove everything later:
  az group delete --name ${RESOURCE_GROUP}
DONE
