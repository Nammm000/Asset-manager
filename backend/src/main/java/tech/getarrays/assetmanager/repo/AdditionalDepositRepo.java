package tech.getarrays.assetmanager.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import tech.getarrays.assetmanager.models.AdditionalDeposit;

public interface AdditionalDepositRepo extends JpaRepository<AdditionalDeposit, Long> {
}
