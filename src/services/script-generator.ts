import { SavingsOpportunity } from '../types';

export interface RemediationScript {
  description: string;
  steps: ScriptStep[];
  estimatedTime: string;
  riskLevel: 'low' | 'medium' | 'high';
  reversible: boolean;
}

export interface ScriptStep {
  description: string;
  command: string;
  optional: boolean;
  confirmationRequired: boolean;
}

export class ScriptGenerator {
  generateRemediation(opportunity: SavingsOpportunity): RemediationScript | null {
    const { provider, resourceType, category } = opportunity;

    if (provider === 'aws') {
      return this.generateAWSScript(opportunity);
    } else if (provider === 'azure') {
      return this.generateAzureScript(opportunity);
    }

    return null;
  }

  private generateAWSScript(opportunity: SavingsOpportunity): RemediationScript | null {
    const { resourceType, resourceId, category, metadata } = opportunity;

    switch (resourceType) {
      case 'ec2':
        if (category === 'idle') {
          return {
            description: 'Stop idle EC2 instance',
            steps: [
              {
                description: 'Create AMI backup (recommended)',
                command: `aws ec2 create-image --instance-id ${resourceId} --name "backup-${resourceId}-$(date +%Y%m%d)" --description "Pre-stop backup"`,
                optional: true,
                confirmationRequired: false,
              },
              {
                description: 'Stop the instance',
                command: `aws ec2 stop-instances --instance-ids ${resourceId}`,
                optional: false,
                confirmationRequired: true,
              },
              {
                description: 'Wait for instance to stop',
                command: `aws ec2 wait instance-stopped --instance-ids ${resourceId}`,
                optional: false,
                confirmationRequired: false,
              },
              {
                description: 'Verify instance state',
                command: `aws ec2 describe-instances --instance-ids ${resourceId} --query 'Reservations[0].Instances[0].State.Name'`,
                optional: false,
                confirmationRequired: false,
              },
            ],
            estimatedTime: '5-10 minutes',
            riskLevel: 'low',
            reversible: true,
          };
        }
        break;

      case 'ebs':
        if (category === 'unused') {
          return {
            description: 'Delete unattached EBS volume',
            steps: [
              {
                description: 'Create snapshot backup',
                command: `aws ec2 create-snapshot --volume-id ${resourceId} --description "Pre-delete backup of ${resourceId}"`,
                optional: true,
                confirmationRequired: false,
              },
              {
                description: 'Wait for snapshot to complete',
                command: `aws ec2 wait snapshot-completed --snapshot-ids <snapshot-id-from-previous-step>`,
                optional: true,
                confirmationRequired: false,
              },
              {
                description: 'Delete the volume',
                command: `aws ec2 delete-volume --volume-id ${resourceId}`,
                optional: false,
                confirmationRequired: true,
              },
            ],
            estimatedTime: '10-15 minutes',
            riskLevel: 'low',
            reversible: true,
          };
        }
        break;

      case 'eip':
        if (category === 'unused') {
          return {
            description: 'Release unassociated Elastic IP',
            steps: [
              {
                description: 'Verify IP is not associated',
                command: `aws ec2 describe-addresses --allocation-ids ${resourceId} --query 'Addresses[0].AssociationId'`,
                optional: false,
                confirmationRequired: false,
              },
              {
                description: 'Release the Elastic IP',
                command: `aws ec2 release-address --allocation-id ${resourceId}`,
                optional: false,
                confirmationRequired: true,
              },
            ],
            estimatedTime: '1 minute',
            riskLevel: 'low',
            reversible: false,
          };
        }
        break;

      case 'elb':
        if (category === 'unused') {
          const elbName = metadata.loadBalancerName || resourceId;
          return {
            description: 'Delete unused load balancer',
            steps: [
              {
                description: 'Check for active targets',
                command: `aws elbv2 describe-target-health --target-group-arn <target-group-arn>`,
                optional: true,
                confirmationRequired: false,
              },
              {
                description: 'Delete the load balancer',
                command: `aws elbv2 delete-load-balancer --load-balancer-arn ${resourceId}`,
                optional: false,
                confirmationRequired: true,
              },
            ],
            estimatedTime: '2-3 minutes',
            riskLevel: 'medium',
            reversible: false,
          };
        }
        break;
    }

    return null;
  }

  private generateAzureScript(opportunity: SavingsOpportunity): RemediationScript | null {
    const { resourceType, resourceId, category, metadata } = opportunity;
    const resourceGroup = this.extractResourceGroup(resourceId);

    if (!resourceGroup) {
      return null;
    }

    switch (resourceType) {
      case 'vm':
        if (category === 'idle') {
          const vmName = metadata.vmName || resourceId;
          return {
            description: 'Stop idle Azure VM',
            steps: [
              {
                description: 'Deallocate (stop) the VM',
                command: `az vm deallocate --resource-group ${resourceGroup} --name ${vmName}`,
                optional: false,
                confirmationRequired: true,
              },
              {
                description: 'Verify VM state',
                command: `az vm show --resource-group ${resourceGroup} --name ${vmName} --query 'powerState'`,
                optional: false,
                confirmationRequired: false,
              },
            ],
            estimatedTime: '3-5 minutes',
            riskLevel: 'low',
            reversible: true,
          };
        }
        break;

      case 'disk':
        if (category === 'unused') {
          const diskName = metadata.diskName || 'unknown';
          return {
            description: 'Delete unattached managed disk',
            steps: [
              {
                description: 'Create snapshot backup',
                command: `az snapshot create --resource-group ${resourceGroup} --name ${diskName}-backup-$(date +%Y%m%d) --source ${resourceId}`,
                optional: true,
                confirmationRequired: false,
              },
              {
                description: 'Delete the disk',
                command: `az disk delete --resource-group ${resourceGroup} --name ${diskName} --yes`,
                optional: false,
                confirmationRequired: true,
              },
            ],
            estimatedTime: '5 minutes',
            riskLevel: 'low',
            reversible: true,
          };
        }
        break;

      case 'ip':
        if (category === 'unused') {
          const ipName = metadata.publicIpName || 'unknown';
          return {
            description: 'Delete unassociated public IP',
            steps: [
              {
                description: 'Verify IP is not associated',
                command: `az network public-ip show --resource-group ${resourceGroup} --name ${ipName} --query 'ipConfiguration'`,
                optional: false,
                confirmationRequired: false,
              },
              {
                description: 'Delete the public IP',
                command: `az network public-ip delete --resource-group ${resourceGroup} --name ${ipName}`,
                optional: false,
                confirmationRequired: true,
              },
            ],
            estimatedTime: '1 minute',
            riskLevel: 'low',
            reversible: false,
          };
        }
        break;
    }

    return null;
  }

  private extractResourceGroup(resourceId: string): string | null {
    const match = resourceId.match(/resourceGroups\/([^\/]+)/i);
    return match ? match[1] : null;
  }

  renderScript(script: RemediationScript): string {
    let output = '';
    output += `# ${script.description}\n`;
    output += `# Estimated time: ${script.estimatedTime}\n`;
    output += `# Risk level: ${script.riskLevel.toUpperCase()}\n`;
    output += `# Reversible: ${script.reversible ? 'Yes' : 'No'}\n\n`;

    script.steps.forEach((step, index) => {
      output += `# Step ${index + 1}: ${step.description}\n`;
      if (step.optional) {
        output += `# (Optional)\n`;
      }
      if (step.confirmationRequired) {
        output += `# ⚠️  CONFIRMATION REQUIRED - Review before running\n`;
      }
      output += `${step.command}\n\n`;
    });

    output += `# Done! Verify the changes took effect.\n`;

    return output;
  }
}
