import pandas as pd
import json
import sys
from jobspy import scrape_jobs

def main():
    try:
        # site = sys.argv[1] if len(sys.argv) > 1 else "linkedin"
        
        # Scrapear empleos usando la librería real JobSpy
        jobs = scrape_jobs(
            site_name=["linkedin"], 
            search_term="React Native", 
            location="Argentina", 
            is_remote=True,
            results_wanted=15, 
            hours_old=72
        )

        # JobSpy retorna un DataFrame de Pandas
        # Opcional: Exportar a CSV
        jobs.to_csv("empleos_react.csv", index=False)
        
        # Guardar en una lista mapeando las propiedades para nuestra base de datos
        jobs_list = []
        for index, row in jobs.iterrows():
            # Limpiar campos para evitar NaNs
            title = str(row.get("title", ""))
            company = str(row.get("company", ""))
            location = str(row.get("location", ""))
            url = str(row.get("job_url", ""))
            description = str(row.get("description", ""))
            
            if title and title != "nan":
                # Filtro: Omitir puestos de Brasil para evitar portugués
                location_lower = location.lower()
                if "brazil" in location_lower or "brasil" in location_lower:
                    continue

                jobs_list.append({
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
