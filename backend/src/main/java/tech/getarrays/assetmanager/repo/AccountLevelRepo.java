package tech.getarrays.assetmanager.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tech.getarrays.assetmanager.models.AccountLevel;

import java.util.Optional;

@Repository
public interface AccountLevelRepo extends JpaRepository<AccountLevel, Long> {
    Optional<AccountLevel> findByCode(String code);
}
