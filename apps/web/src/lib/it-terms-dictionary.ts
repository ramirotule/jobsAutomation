export interface ITTerm {
  label: string;
  category: string;
}

export const IT_TERMS_DICTIONARY: ITTerm[] = [
  // Backend Languages
  { label: "Java", category: "Backend" },
  { label: "Python", category: "Backend" },
  { label: "Go", category: "Backend" },
  { label: "Golang", category: "Backend" },
  { label: "Ruby", category: "Backend" },
  { label: "PHP", category: "Backend" },
  { label: "C#", category: "Backend" },
  { label: ".NET", category: "Backend" },
  { label: "Rust", category: "Backend" },
  { label: "Scala", category: "Backend" },
  { label: "Perl", category: "Backend" },
  { label: "COBOL", category: "Backend" },
  { label: "C++", category: "Backend" },
  { label: "Elixir", category: "Backend" },
  { label: "Erlang", category: "Backend" },
  { label: "Haskell", category: "Backend" },
  // Backend Frameworks
  { label: "Spring", category: "Backend" },
  { label: "Spring Boot", category: "Backend" },
  { label: "Django", category: "Backend" },
  { label: "FastAPI", category: "Backend" },
  { label: "Flask", category: "Backend" },
  { label: "Rails", category: "Backend" },
  { label: "Ruby on Rails", category: "Backend" },
  { label: "Laravel", category: "Backend" },
  { label: "Symfony", category: "Backend" },
  { label: "NestJS", category: "Backend" },
  { label: "Express", category: "Backend" },
  { label: "Gin", category: "Backend" },
  { label: "Echo", category: "Backend" },
  // Cloud
  { label: "AWS", category: "Cloud" },
  { label: "GCP", category: "Cloud" },
  { label: "Azure", category: "Cloud" },
  { label: "S3", category: "Cloud" },
  { label: "Lambda", category: "Cloud" },
  { label: "EC2", category: "Cloud" },
  { label: "CloudFront", category: "Cloud" },
  { label: "DynamoDB", category: "Cloud" },
  // DevOps / Infra
  { label: "Kubernetes", category: "DevOps" },
  { label: "Terraform", category: "DevOps" },
  { label: "Ansible", category: "DevOps" },
  { label: "Jenkins", category: "DevOps" },
  { label: "Chef", category: "DevOps" },
  { label: "Puppet", category: "DevOps" },
  { label: "Nginx", category: "DevOps" },
  { label: "Linux", category: "DevOps" },
  { label: "Bash", category: "DevOps" },
  { label: "Shell scripting", category: "DevOps" },
  { label: "Helm", category: "DevOps" },
  { label: "ArgoCD", category: "DevOps" },
  { label: "Prometheus", category: "DevOps" },
  { label: "Grafana", category: "DevOps" },
  { label: "SRE", category: "DevOps" },
  // Databases
  { label: "PostgreSQL", category: "Database" },
  { label: "MySQL", category: "Database" },
  { label: "MongoDB", category: "Database" },
  { label: "Redis", category: "Database" },
  { label: "Elasticsearch", category: "Database" },
  { label: "Cassandra", category: "Database" },
  { label: "Oracle", category: "Database" },
  { label: "SQL Server", category: "Database" },
  { label: "CockroachDB", category: "Database" },
  // Data / ML / AI
  { label: "Machine Learning", category: "Data" },
  { label: "TensorFlow", category: "Data" },
  { label: "PyTorch", category: "Data" },
  { label: "Pandas", category: "Data" },
  { label: "NumPy", category: "Data" },
  { label: "Spark", category: "Data" },
  { label: "Kafka", category: "Data" },
  { label: "Hadoop", category: "Data" },
  { label: "ETL", category: "Data" },
  { label: "Data Science", category: "Data" },
  { label: "Data Engineer", category: "Data" },
  { label: "MLOps", category: "Data" },
  { label: "Airflow", category: "Data" },
  { label: "dbt", category: "Data" },
  // Mobile Native
  { label: "Swift", category: "Mobile" },
  { label: "Objective-C", category: "Mobile" },
  { label: "Flutter", category: "Mobile" },
  { label: "Dart", category: "Mobile" },
  { label: "Kotlin", category: "Mobile" },
  { label: "Android", category: "Mobile" },
  { label: "iOS", category: "Mobile" },
  { label: "Xamarin", category: "Mobile" },
  // ERP / CRM / SAP
  { label: "SAP", category: "ERP" },
  { label: "Salesforce", category: "CRM" },
  { label: "ServiceNow", category: "CRM" },
  // Blockchain / Web3
  { label: "Blockchain", category: "Web3" },
  { label: "Solidity", category: "Web3" },
  { label: "Web3", category: "Web3" },
  { label: "Smart contracts", category: "Web3" },
  // Embedded / Hardware
  { label: "Embedded", category: "Hardware" },
  { label: "FPGA", category: "Hardware" },
  { label: "Arduino", category: "Hardware" },
  { label: "IoT", category: "Hardware" },
  // Architecture / Patterns
  { label: "microservices", category: "Architecture" },
  { label: "event-driven", category: "Architecture" },
  { label: "CQRS", category: "Architecture" },
  { label: "gRPC", category: "Architecture" },
  { label: "SOAP", category: "Architecture" },
  // QA
  { label: "Selenium", category: "QA" },
  { label: "QA Engineer", category: "QA" },
  { label: "manual testing", category: "QA" },
  { label: "performance testing", category: "QA" },
  { label: "JMeter", category: "QA" },
];

export function searchITTerms(query: string): ITTerm[] {
  if (!query || query.length < 2) return [];
  const lower = query.toLowerCase();
  return IT_TERMS_DICTIONARY.filter((t) =>
    t.label.toLowerCase().includes(lower)
  ).slice(0, 8);
}
