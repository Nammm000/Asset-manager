package tech.getarrays.assetmanager.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tech.getarrays.assetmanager.models.Currency;

@Repository
public interface CurrencyRepo extends JpaRepository<Currency, String> {
}