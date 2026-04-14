import pandas as pd
import json
import sys
from jobspy import scrape_jobs

def main():
    try:
        site = sys.argv[1] if len(sys.argv) > 1 else "linkedin"
        search_term = sys.argv[2] if len(sys.argv) > 2 else "frontend developer"
        hours_old = int(sys.argv[3]) if len(sys.argv) > 3 else 24
        
        # Determinar qué sitios scrapear
        # Si site es "all", usamos una lista balanceada
        site_names = [site] if site != "all" else ["linkedin", "indeed", "glassdoor"]
        
        # Scrapear empleos
        scrape_params = {
            "site_name": site_names,
            "location": "Remote",
            "is_remote": True,
            "job_type": "fulltime",
            "results_wanted": 15,
            "hours_old": hours_old,
            "country_indeed": 'argentina'
        }

        # Manejo especial para Google (requiere google_search_term)
        if "google" in site_names:
            scrape_params["google_search_term"] = search_term
        else:
            scrape_params["search_term"] = search_term

        jobs = scrape_jobs(**scrape_params)


        # JobSpy retorna un DataFrame de Pandas
        # Opcional: Exportar a CSV
        jobs.to_csv("empleos_react.csv", index=False)
        
        # Guardar en una lista mapeando las propiedades para nuestra base de datos
        jobs_list = []
        seen_jobs = set() # Para evitar duplicados de (titulo, empresa)

        for index, row in jobs.iterrows():
            # Limpiar campos para evitar NaNs
            title = str(row.get("title", "")).strip()
            company = str(row.get("company", "")).strip()
            location = str(row.get("location", "")).strip()
            url = str(row.get("job_url", ""))
            description = str(row.get("description", ""))
            
            if title and title != "nan":
                # Deduplicación ultra-agresiva: Una sola vacante por empresa
                job_key = company.lower()
                if job_key in seen_jobs:
                    continue
                seen_jobs.add(job_key)

                # Filtro: Omitir puestos de Brasil para evitar portugués
                location_lower = location.lower()
                if "brazil" in location_lower or "brasil" in location_lower:
                    continue

                jobs_list.append({
                    "external_id": str(row.get("id", index)), # ID único de la plataforma
                    "site": str(row.get("site", "linkedin")),
                    "title": title,
                    "company": company if company != "nan" else "",
                    "location": location if location != "nan" else "",
                    "applyUrl": url if url != "nan" else "https://linkedin.com/jobs",
                    "description": description if description != "nan" else ""
                })

        # Omitimos print standard y enviamos el JSON final
        print(json.dumps({
            "status": "success",
            "count": len(jobs_list),
            "message": f"Encontrados {len(jobs_list)} empleos.",
            "data": jobs_list
        }))
    except Exception as e:
        # En caso de error, siempre imprimir un JSON para que Node.js no falle parseando texto
        print(json.dumps({
            "status": "error",
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
