# Test environment on Azure

The test environment runs the real application (ASP.NET Core + Azure SQL) at a public address like `https://gymlogger-test-4821.azurewebsites.net`. Testers can use it without installing anything. It follows the spec's environment strategy (§42): **Development → Test → UAT → Production**.

| Part | Azure service | Cost |
|---|---|---|
| Web app | App Service, Linux, **Free F1** plan | Free (60 CPU minutes/day, sleeps when idle). Basic B1 is about USD 13/month if F1 isn't available (see [Troubleshooting](#troubleshooting-the-setup-script)). |
| Database | Azure SQL Database, serverless, **free offer** | Free (pauses if the monthly free allowance runs out) |

Every push to `main` or `claude/jolly-gates-t1qagy` runs the tests, deploys, and checks `/health`. You can also run it by hand from the Actions tab.

## One-time setup (about 10 minutes)

You need an Azure account ([free sign-up](https://azure.microsoft.com/free)) and admin access to this GitHub repository.

### 1. Create the Azure resources

1. Open **[Azure Cloud Shell](https://shell.azure.com)** and choose **Bash**. Nothing needs installing, and you are already signed in.
2. Pick a name for the site. It becomes part of the address, so it must be unique across Azure (lowercase letters, numbers and hyphens), for example `gymlogger-test-4821`.
3. Run the setup script, replacing the name:

```bash
curl -fsSL https://raw.githubusercontent.com/Vishnu040390/GymLoggerApp/claude/jolly-gates-t1qagy/deploy/azure/create-test-environment.sh -o create-test-env.sh
APP_NAME=gymlogger-test-4821 LOCATION=eastus bash create-test-env.sh
```

Use the region nearest your testers for `LOCATION`, for example `centralindia`, `westeurope` or `uksouth`. The script takes a few minutes. When it finishes it prints:

- the site address,
- the **test-site admin email and password**, shown only once, so save them,
- the name of a `.PublishSettings` file it created, which GitHub needs in the next step.

Other options you can set in front of the command:
- `DEMO_TIME_ZONE`: for example `Asia/Kolkata`, so demo workout times read naturally.
- `ADMIN_EMAIL`: the admin sign-in address.
- `SQL_FREE=false`: if your subscription has already used its free Azure SQL database.
- `PLAN_SKU=B1`: the smallest paid plan, if your subscription has no free (F1) quota.
- `SQL_LOCATION`: a different region for the database only.

The script is safe to run again after fixing a problem. It reuses whatever it has already created.

### Troubleshooting the setup script

| Message | Cause | Fix |
|---|---|---|
| `Operation cannot be completed without additional quota ... Current Limit (F1 VMs): 0` | New and free-trial subscriptions often have no free App Service quota in busy regions such as `eastus`. | Use another region: `APP_NAME=... LOCATION=centralindia bash create-test-env.sh` (or `southindia`, `westeurope`, `uksouth`, `westus2`). You can also ask for quota: Azure portal → **Quotas** → App Service → your region → F1 → new limit **1**. Or use the paid plan: add `PLAN_SKU=B1`. |
| `Location '...' is not accepting creation of new Windows Azure SQL Database servers` | Azure SQL capacity is restricted in that region for your subscription. | Add `SQL_LOCATION=centralindia` (or another region) and run the script again. The web app can stay where it is. |
| `Selected user account does not exist in tenant ...` | The Microsoft account has no Azure subscription yet. | Sign up at [azure.microsoft.com/free](https://azure.microsoft.com/free), then open Cloud Shell from [portal.azure.com](https://portal.azure.com). |
| `Website with given name ... already exists` | Site names are unique across all of Azure. | Pick a different `APP_NAME`. |

### 2. Connect GitHub

In the repository go to **Settings → Secrets and variables → Actions**:

1. **Variables** tab → **New repository variable**
   - Name: `AZURE_WEBAPP_NAME`
   - Value: your site name (for example `gymlogger-test-4821`)
2. **Secrets** tab → **New repository secret**
   - Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
   - Value: the whole contents of the `.PublishSettings` file. In Cloud Shell, run `cat gymlogger-test-4821.PublishSettings` and copy everything it prints.
3. Delete the `.PublishSettings` file from Cloud Shell once the secret is saved.

### 3. Deploy

Go to **Actions → Deploy to test → Run workflow**. The first deploy creates the database tables and demo data, which can take a few minutes on the Free plan. When the run is green, open the address from step 1.

## Using the test site

| Account | Email | Password |
|---|---|---|
| Administrator | set by the script (default `admin@gymlogger.test`) | printed by the script |
| Lifter with 8 weeks of history | `demo@gymlogger.test` | `Demo@1234` |
| Second user (isolation checks) | `other@gymlogger.test` | `Other@1234` |

Testers can also register their own accounts.

The demo passwords are public (they are in this repository), so treat the test site as open to anyone who knows the address. Don't enter real personal data. The admin password is unique to your environment.

## Good to know

- **First request after a quiet period is slow:** the Free plan and the serverless database both sleep when idle. The first page load can take 30–60 seconds.
- **Data is kept between deploys:** it lives in Azure SQL. To start again with fresh demo data, delete and re-create the database, or remove the whole environment (below) and run the script again.
- **Logs:** Azure portal → your web app → **Log stream**.
- **Uploaded photos and videos:** stored on the web app's persistent disk (`/home/data/gymlogger/media`).
- **Remove everything:** `az group delete --name <APP_NAME>-rg` in Cloud Shell.

## How it fits together

```text
push ──► GitHub Actions "Deploy to test"
          ├─ dotnet test          (quality gate: stops here if anything fails)
          ├─ dotnet publish
          ├─ deploy to App Service (publish profile secret)
          └─ smoke test: GET /health until "Healthy"
                     │
                     ▼
     https://<APP_NAME>.azurewebsites.net   (ASPNETCORE_ENVIRONMENT=Test)
          └─ Azure SQL: migrations applied on start-up, demo data seeded once
```

Settings for the Test environment are in `src/GYM.Web/appsettings.Test.json`. Secrets (the database connection and admin password) live only in the App Service configuration.
