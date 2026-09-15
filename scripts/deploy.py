#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import time
from pathlib import Path

OCI_BIN = "/home/karan/bin/oci"
COMPARTMENT_ID = "ocid1.tenancy.oc1..aaaaaaaax5f3bhjaisvlew3ktx25nfplfesbi7jujv6igxibkurrrseatdqq"
AD = "uYTD:AP-MUMBAI-1-AD-1"
SUBNET_ID = "ocid1.subnet.oc1.ap-mumbai-1.aaaaaaaaf3daimwc6mv2c5n5umovajadmg7oyedwxok3rv7nxzrwb6ijzaxq"
SSH_KEY_PATH = Path.home() / ".ssh" / "oci_cric_key"
SSH_PUB_PATH = Path.home() / ".ssh" / "oci_cric_key.pub"

IMAGE_A1_ARM64 = "ocid1.image.oc1.ap-mumbai-1.aaaaaaaavpkbfemaxi7gfzobc4qsc3p2m5szuswd7skrxvzo5teii6bfkd2a"
IMAGE_MICRO_X86 = "ocid1.image.oc1.ap-mumbai-1.aaaaaaaaiyiten5jrproqssxgellwji2jzh5misw3x7y3zmkap5tjt2bcoyq"

REPO_ROOT = Path(__file__).resolve().parent.parent
CLOUD_INIT_SCRIPT = REPO_ROOT / "scripts" / "cloud-init.sh"


def run_oci(args, check=True):
    cmd = [OCI_BIN] + args + ["--output", "json"]
    print(f"  [OCI CLI] {' '.join(cmd[:6])}...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if check and res.returncode != 0:
        raise RuntimeError(f"OCI CLI failed with code {res.returncode}:\nSTDERR: {res.stderr}\nSTDOUT: {res.stdout}")
    return res


def get_existing_instance():
    print("===> Checking for existing CricScore compute instances...")
    res = run_oci(["compute", "instance", "list", "--compartment-id", COMPARTMENT_ID], check=False)
    if res.returncode != 0 or not res.stdout.strip():
        return None

    try:
        raw = json.loads(res.stdout)
        data = raw.get("data", []) if isinstance(raw, dict) else (raw if isinstance(raw, list) else [])
        for inst in data:
            if inst.get("display-name") == "cricscore-server" and inst.get("lifecycle-state") in ["RUNNING", "PROVISIONING", "STARTING"]:
                print(f"  Found existing active instance: {inst.get('id')} ({inst.get('lifecycle-state')})")
                return inst
    except Exception as e:
        print(f"  Error parsing instances response: {e}")
    return None


def launch_instance():
    existing = get_existing_instance()
    if existing:
        return existing["id"]

    # Candidate shapes in order of preference
    shapes = [
        {
            "name": "Ampere A1 Flex (2 OCPU / 12 GB RAM)",
            "shape": "VM.Standard.A1.Flex",
            "image": IMAGE_A1_ARM64,
            "shape_config": '{"ocpus": 2, "memoryInGBs": 12}',
        },
        {
            "name": "Ampere A1 Flex (1 OCPU / 6 GB RAM)",
            "shape": "VM.Standard.A1.Flex",
            "image": IMAGE_A1_ARM64,
            "shape_config": '{"ocpus": 1, "memoryInGBs": 6}',
        },
        {
            "name": "AMD E2.1.Micro (1 OCPU / 1 GB RAM + 4GB Swap)",
            "shape": "VM.Standard.E2.1.Micro",
            "image": IMAGE_MICRO_X86,
            "shape_config": None,
        },
    ]

    for cand in shapes:
        print(f"\n===> Attempting launch: {cand['name']}...")
        cmd = [
            "compute", "instance", "launch",
            "--availability-domain", AD,
            "--compartment-id", COMPARTMENT_ID,
            "--display-name", "cricscore-server",
            "--image-id", cand["image"],
            "--shape", cand["shape"],
            "--subnet-id", SUBNET_ID,
            "--assign-public-ip", "true",
            "--ssh-authorized-keys-file", str(SSH_PUB_PATH),
            "--user-data-file", str(CLOUD_INIT_SCRIPT),
        ]
        if cand["shape_config"]:
            cmd += ["--shape-config", cand["shape_config"]]

        res = run_oci(cmd, check=False)
        if res.returncode == 0:
            try:
                data = json.loads(res.stdout).get("data", {})
                instance_id = data.get("id")
                print(f"===> Success! Launched instance {instance_id}")
                return instance_id
            except Exception as e:
                print(f"Error parsing launch response: {e}")
        else:
            print(f"  Launch candidate failed with error:\n  {res.stderr.strip()}")
            if "Out of host capacity" in res.stderr or "OutOfCapacity" in res.stderr or "TooManyRequests" in res.stderr or "LimitExceeded" in res.stderr:
                print("  => Host capacity or limit reached, falling back to next shape...")
                continue
            else:
                print("  => Unexpected error, continuing fallback...")

    raise RuntimeError("Failed to launch any compute instance shape.")


def wait_for_running(instance_id, timeout=300):
    print(f"===> Waiting for instance {instance_id} to reach RUNNING state...")
    start = time.time()
    while time.time() - start < timeout:
        res = run_oci(["compute", "instance", "get", "--instance-id", instance_id])
        data = json.loads(res.stdout).get("data", {})
        state = data.get("lifecycle-state")
        print(f"  Current state: {state} ({int(time.time() - start)}s elapsed)")
        if state == "RUNNING":
            return data
        if state in ["TERMINATED", "TERMINATING"]:
            raise RuntimeError(f"Instance entered {state} state unexpectedly.")
        time.sleep(10)
    raise TimeoutError(f"Instance did not become RUNNING within {timeout}s")


def get_public_ip(instance_id):
    print(f"===> Fetching Public IP for instance {instance_id}...")
    res = run_oci(["compute", "instance", "list-vnics", "--instance-id", instance_id])
    vnics = json.loads(res.stdout).get("data", [])
    for vnic in vnics:
        pub_ip = vnic.get("public-ip")
        if pub_ip:
            print(f"  Public IP resolved: {pub_ip}")
            return pub_ip
    raise RuntimeError(f"No public IP found on VNICs for instance {instance_id}")


def run_ssh(ip, remote_cmd, check=True):
    ssh_cmd = [
        "ssh",
        "-i", str(SSH_KEY_PATH),
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "-o", "ConnectTimeout=10",
        f"ubuntu@{ip}",
        remote_cmd,
    ]
    return subprocess.run(ssh_cmd, capture_output=True, text=True, check=check)


def wait_for_ssh_and_cloud_init(ip, timeout=400):
    print(f"===> Waiting for SSH connectivity and Cloud-Init on {ip}...")
    start = time.time()
    ssh_ready = False

    while time.time() - start < timeout:
        try:
            res = run_ssh(ip, "echo 'ssh_ok'", check=False)
            if res.returncode == 0 and "ssh_ok" in res.stdout:
                ssh_ready = True
                break
        except Exception:
            pass
        print(f"  Waiting for SSH ({int(time.time() - start)}s)...")
        time.sleep(8)

    if not ssh_ready:
        raise TimeoutError(f"SSH port unreachable after {timeout}s")

    print("  SSH connected! Waiting for cloud-init to finalize Docker setup...")
    while time.time() - start < timeout:
        res = run_ssh(ip, "test -f /opt/cricscore/.init_complete && echo 'complete' || echo 'pending'", check=False)
        if "complete" in res.stdout:
            print("  Cloud-init provisioning completed successfully!")
            return True
        time.sleep(8)

    raise TimeoutError("Cloud-init did not finish in time.")


def sync_project_files(ip):
    print(f"===> Syncing project files to ubuntu@{ip}:/opt/cricscore...")
    excludes = [
        ".git",
        "node_modules",
        ".next",
        ".env*.local",
        "*.log",
        ".DS_Store",
        ".agents",
    ]
    exclude_args = []
    for exc in excludes:
        exclude_args += ["--exclude", exc]

    rsync_cmd = [
        "rsync",
        "-avz",
        "--delete",
        "-e", f"ssh -i {SSH_KEY_PATH} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null",
    ] + exclude_args + [f"{REPO_ROOT}/", f"ubuntu@{ip}:/opt/cricscore/"]

    res = subprocess.run(rsync_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Rsync failed:\nSTDERR: {res.stderr}\nSTDOUT: {res.stdout}")
    print("  File synchronization complete!")


def setup_remote_env(ip):
    print("===> Configuring production environment on remote instance...")
    env_content = """# Production Environment Variables
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
APP_DOMAIN=:80
LETSENCRYPT_EMAIL=admin@cricscore.local

# Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
SKIP_ENV_VALIDATION=1
"""
    # Write .env remotely
    write_cmd = f"cat <<'EOF' > /opt/cricscore/.env\n{env_content}\nEOF"
    run_ssh(ip, write_cmd)
    print("  Production .env written.")


def build_and_deploy_docker(ip):
    print("===> Deploying Docker services on remote host...")
    deploy_cmd = """
    cd /opt/cricscore
    docker compose down --remove-orphans || true
    docker compose build --pull
    docker compose up -d
    """
    res = run_ssh(ip, deploy_cmd, check=False)
    if res.returncode != 0:
        print(f"Warning/Error during docker compose:\n{res.stderr}\n{res.stdout}")
        raise RuntimeError("Docker compose deployment failed on remote host.")
    print("  Docker containers successfully built and started!")


def verify_deployment(ip, timeout=120):
    print(f"===> Verifying deployment health check at http://{ip}/api/health...")
    start = time.time()
    while time.time() - start < timeout:
        try:
            curl_res = subprocess.run(
                ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"http://{ip}/api/health"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            code = curl_res.stdout.strip()
            if code == "200":
                print("  Health check verified HTTP 200 OK!")
                # Get response body
                body = subprocess.run(
                    ["curl", "-s", f"http://{ip}/api/health"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                ).stdout.strip()
                print(f"  Response body: {body}")
                return True
            else:
                print(f"  Health check returned HTTP {code} ({int(time.time() - start)}s elapsed)...")
        except Exception as e:
            print(f"  Health check waiting: {e}")
        time.sleep(5)
    raise TimeoutError("Deployment health check did not respond with 200 OK within timeout.")


def main():
    print("=================================================================")
    print("       CricScore Overlay - OCI Autonomous Cloud Deployer        ")
    print("=================================================================")
    print(f"Target Tenancy: {COMPARTMENT_ID[:20]}...")
    print(f"Target Subnet:  {SUBNET_ID[:20]}...")
    print(f"SSH Key:        {SSH_KEY_PATH}")

    # 1. Launch instance or get existing
    instance_id = launch_instance()

    # 2. Wait for RUNNING state
    wait_for_running(instance_id)

    # 3. Get Public IP
    ip = get_public_ip(instance_id)

    # 4. Wait for SSH & Cloud Init
    wait_for_ssh_and_cloud_init(ip)

    # 5. Sync Project Files
    sync_project_files(ip)

    # 6. Setup remote .env
    setup_remote_env(ip)

    # 7. Build and run containers
    build_and_deploy_docker(ip)

    # 8. Verify deployment
    verify_deployment(ip)

    print("\n=================================================================")
    print("                   DEPLOYMENT SUCCESSFUL!                        ")
    print("=================================================================")
    print(f"Server Public IP : {ip}")
    print(f"Application URL  : http://{ip}")
    print(f"Healthcheck URL  : http://{ip}/api/health")
    print(f"SSH Access       : ssh -i {SSH_KEY_PATH} ubuntu@{ip}")
    print("=================================================================")


if __name__ == "__main__":
    main()
