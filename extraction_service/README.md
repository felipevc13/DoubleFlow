# LangExtract Analysis Service

A FastAPI microservice for extracting and analyzing text data using LangExtract.

## Setup

1. Create and activate a virtual environment:

   ```bash
   # Recomenda-se criar o ambiente virtual FORA da pasta do projeto frontend (Nuxt) para evitar conflitos de watchers.
   python3 -m venv ~/doubleflow-langextract-env
   source ~/doubleflow-langextract-env/bin/activate  # No Windows: %USERPROFILE%\doubleflow-langextract-env\Scripts\activate
   ```

   > **Observação:** Evite criar ambientes virtuais dentro de projetos frontend para não causar problemas de watchers (como EMFILE: too many open files).

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

## Running the Service

1. Start the FastAPI development server:

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. The service will be available at `http://localhost:8000`

3. API documentation will be available at:
   - Swagger UI: `http://localhost:8000/docs`
   - ReDoc: `http://localhost:8000/redoc`

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# API Configuration
API_KEY=your_api_key_here
DEBUG=true
```

## API Endpoints

- `GET /health`: Health check endpoint
- `POST /extract`: Extract insights from text

## Development

### Testing

To run tests:

```bash
pytest
```

### Linting

```bash
flake8 .
black .
isort .
```

## Deployment

For production deployment, consider using:

- Gunicorn with Uvicorn workers
- Docker
- Kubernetes
- AWS ECS/EKS
- Google Cloud Run
- Azure Container Instances
