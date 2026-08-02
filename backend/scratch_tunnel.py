import subprocess
import sys
import time

print("Iniciando tunel de Serveo para el puerto 4173...")
# Comando SSH nativo para abrir el tunel en Serveo
cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "-R", "80:localhost:4173", "serveo.net"]

try:
    # Iniciar el subproceso redireccionando stdout y stderr
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1  # Line buffered
    )
    
    # Leer las primeras lineas de salida para encontrar la URL
    url_found = False
    start_time = time.time()
    
    with open("tunnel_url.txt", "w") as f:
        f.write("") # Limpiar
        
    while True:
        # Si pasa mas de 15 segundos, salir del bucle de busqueda
        if time.time() - start_time > 15:
            print("Tiempo de espera agotado buscando la URL.")
            break
            
        line = process.stdout.readline()
        if not line:
            # Si el proceso termino
            break
            
        line_str = line.strip()
        print(f"SSH: {line_str}")
        
        # Guardar en archivo local
        with open("tunnel_url.txt", "a") as f:
            f.write(line_str + "\n")
            
        if "serveo.net" in line_str:
            print(f"¡URL encontrada! -> {line_str}")
            url_found = True
            # No cerramos el proceso, debe quedar corriendo en segundo plano.
            
except Exception as e:
    print(f"Error al iniciar el tunel: {e}")
    sys.exit(1)
