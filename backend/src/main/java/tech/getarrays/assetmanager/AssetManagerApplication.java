package tech.getarrays.assetmanager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AssetManagerApplication {

	public static void main(String[] args) {
		SpringApplication.run(AssetManagerApplication.class, args);
	}

}
